import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.module';

/**
 * SMART-on-FHIR authorisation server. Implements:
 *   - SMART App Launch v2 standalone+EHR launch
 *   - PKCE (S256) for public clients
 *   - client_secret_basic for confidential clients
 *   - Launch context parameters: `patient`, `encounter`
 *
 * NOTE: This is a deliberately compact, single-file implementation that
 * reuses the existing JWT signing infrastructure for issued access tokens.
 * For production, plug in a JOSE library that supports JWKS publication so
 * SMART backend services profile (asymmetric client auth) works end-to-end.
 */
@Injectable()
export class SmartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  // ───────── Well-known discovery ─────────

  buildWellKnown(baseUrl: string) {
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
      scopes_supported: [
        'openid', 'fhirUser', 'profile', 'offline_access',
        'launch', 'launch/patient', 'launch/encounter',
        'patient/*.read', 'patient/*.rs',
        'user/*.read',
      ],
      capabilities: [
        'launch-standalone',
        'launch-ehr',
        'client-public',
        'client-confidential-symmetric',
        'context-standalone-patient',
        'context-ehr-patient',
        'permission-patient',
        'permission-user',
        'permission-v2',
      ],
      response_modes_supported: ['query'],
    };
  }

  // ───────── /authorize (PKCE) ─────────

  async beginAuthorize(params: {
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    aud?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    launch?: string;
  }) {
    if (params.response_type !== 'code') {
      throw new BadRequestException('Only response_type=code is supported');
    }
    const client = await this.prisma.oAuthClient.findUnique({ where: { clientId: params.client_id ?? '' } });
    if (!client || client.revokedAt) throw new UnauthorizedException('Unknown client');
    if (!params.redirect_uri || !client.redirectUris.includes(params.redirect_uri)) {
      throw new UnauthorizedException('redirect_uri mismatch');
    }
    if (!client.isConfidential && (!params.code_challenge || params.code_challenge_method !== 'S256')) {
      throw new BadRequestException('PKCE S256 is required for public clients');
    }
    return {
      consentRequired: true,
      client: { id: client.id, name: client.name, scopes: client.scopes },
      params,
    };
  }

  /** Called by the consent UI once the user approves; issues a one-time code. */
  async issueAuthCode(input: {
    clientDbId: string;
    userId: string;
    redirectUri: string;
    scope: string;
    patientId?: string;
    encounterId?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }) {
    const code = randomBytes(32).toString('base64url');
    await this.prisma.oAuthAuthCode.create({
      data: {
        clientId: input.clientDbId,
        userId: input.userId,
        codeHash: sha256(code),
        redirectUri: input.redirectUri,
        scopes: input.scope,
        patientId: input.patientId,
        encounterId: input.encounterId,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod,
        expiresAt: new Date(Date.now() + 60_000), // 60s, per SMART recommendations
      },
    });
    return code;
  }

  // ───────── /token ─────────

  async exchangeCode(body: Record<string, string>, basicAuth?: { id: string; secret: string }) {
    if (body.grant_type !== 'authorization_code') {
      throw new BadRequestException('Only authorization_code is supported here');
    }
    const code = body.code;
    if (!code) throw new BadRequestException('code is required');

    const stored = await this.prisma.oAuthAuthCode.findUnique({
      where: { codeHash: sha256(code) },
      include: { client: true },
    });
    if (!stored) throw new UnauthorizedException('Invalid code');
    if (stored.consumedAt) throw new UnauthorizedException('Code already used');
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Code expired');
    if (stored.redirectUri !== body.redirect_uri) throw new UnauthorizedException('redirect_uri mismatch');

    // Client authentication
    const presentedId = basicAuth?.id ?? body.client_id;
    if (presentedId !== stored.client.clientId) throw new UnauthorizedException('client mismatch');
    if (stored.client.isConfidential) {
      if (!basicAuth?.secret || !stored.client.clientSecretHash) {
        throw new UnauthorizedException('Client secret required');
      }
      const ok = constantTimeEquals(sha256(basicAuth.secret), stored.client.clientSecretHash);
      if (!ok) throw new UnauthorizedException('Invalid client secret');
    } else {
      if (!body.code_verifier) throw new BadRequestException('code_verifier required');
      const expected = stored.codeChallenge;
      const calc = stored.codeChallengeMethod === 'S256'
        ? createHash('sha256').update(body.code_verifier).digest('base64url')
        : body.code_verifier;
      if (!expected || expected !== calc) throw new UnauthorizedException('PKCE verification failed');
    }

    // Issue access token (opaque-style: random + DB-tracked)
    const accessToken = randomBytes(40).toString('base64url');
    const expiresIn = Number(this.cfg.get('SMART_ACCESS_TTL_SECONDS') ?? 3600);
    await this.prisma.oAuthAccessToken.create({
      data: {
        clientId: stored.clientId,
        userId: stored.userId,
        tokenHash: sha256(accessToken),
        scopes: stored.scopes,
        patientId: stored.patientId,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });
    await this.prisma.oAuthAuthCode.update({
      where: { id: stored.id },
      data: { consumedAt: new Date() },
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: stored.scopes,
      patient: stored.patientId ?? undefined,
      encounter: stored.encounterId ?? undefined,
    };
  }

  // ───────── Dynamic Client Registration (RFC 7591) ─────────

  async register(body: {
    client_name: string;
    redirect_uris: string[];
    scope?: string;
    token_endpoint_auth_method?: 'client_secret_basic' | 'none';
    jwks_uri?: string;
    tenantId?: string;
  }) {
    if (!body.client_name || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      throw new BadRequestException('client_name and redirect_uris are required');
    }
    const isConfidential = body.token_endpoint_auth_method !== 'none';
    const clientId = `kc_${randomBytes(12).toString('hex')}`;
    const clientSecret = isConfidential ? randomBytes(32).toString('base64url') : undefined;

    const created = await this.prisma.oAuthClient.create({
      data: {
        tenantId: body.tenantId ?? 'default',
        clientId,
        clientSecretHash: clientSecret ? sha256(clientSecret) : null,
        name: body.client_name,
        redirectUris: body.redirect_uris,
        scopes: body.scope ?? 'launch/patient openid fhirUser patient/*.read',
        jwksUri: body.jwks_uri,
        isConfidential,
      },
    });

    return {
      client_id: created.clientId,
      client_secret: clientSecret,            // shown once; never retrievable later
      client_id_issued_at: Math.floor(created.createdAt.getTime() / 1000),
      client_name: created.name,
      redirect_uris: created.redirectUris,
      scope: created.scopes,
      token_endpoint_auth_method: isConfidential ? 'client_secret_basic' : 'none',
    };
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
