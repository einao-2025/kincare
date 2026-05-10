import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import type { Role } from '@kincare/shared';

export interface AccessTokenClaims extends JwtPayload {
  sub: string;        // userId
  role: Role;
  email: string;
  sid: string;        // sessionId
  mfa: boolean;
  tid?: string;       // tenantId (Phase 5 multi-tenant)
}

export interface RefreshTokenClaims extends JwtPayload {
  sub: string;
  sid: string;
  jti: string;        // refresh token id (matches DB row)
}

export interface TokenConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  issuer?: string;
}

export function signAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss'>, cfg: TokenConfig): string {
  const opts: SignOptions = { expiresIn: cfg.accessTtlSeconds, issuer: cfg.issuer };
  return jwt.sign(claims, cfg.accessSecret, opts);
}

export function signRefreshToken(claims: Omit<RefreshTokenClaims, 'iat' | 'exp' | 'iss'>, cfg: TokenConfig): string {
  const opts: SignOptions = { expiresIn: cfg.refreshTtlSeconds, issuer: cfg.issuer };
  return jwt.sign(claims, cfg.refreshSecret, opts);
}

export function verifyAccessToken(token: string, cfg: TokenConfig): AccessTokenClaims {
  return jwt.verify(token, cfg.accessSecret, { issuer: cfg.issuer }) as AccessTokenClaims;
}

export function verifyRefreshToken(token: string, cfg: TokenConfig): RefreshTokenClaims {
  return jwt.verify(token, cfg.refreshSecret, { issuer: cfg.issuer }) as RefreshTokenClaims;
}
