import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * HMAC double-submit cookie CSRF protection.
 *
 * Strategy: on any safe request (GET/HEAD/OPTIONS) we ensure a `csrf_token`
 * cookie exists. The cookie value is `<random>.<hmac(secret, random)>`.
 * For unsafe methods (POST/PUT/PATCH/DELETE) the client must echo the cookie
 * value via the `X-CSRF-Token` header. We verify the HMAC and constant-time
 * compare the header to the cookie.
 *
 * Bearer-token-only API clients (mobile, server-to-server, CI scripts) are
 * exempt: requests with `Authorization: Bearer ...` and no cookies skip the
 * check, since there is no browser-driven cookie that could be forged.
 *
 * Endpoints under EXEMPT_PREFIXES are skipped (health, login bootstrap, MLLP
 * is on its own port). Webhooks must be explicitly allow-listed.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private static readonly COOKIE = 'csrf_token';
  private static readonly HEADER = 'x-csrf-token';
  private static readonly EXEMPT_PREFIXES = [
    '/health',
    '/metrics',
    '/.well-known/',
    '/oauth/token',
    '/oauth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/docs',
  ];
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  private readonly secret: string;
  private readonly secureCookie: boolean;
  private readonly sameSite: 'lax' | 'none' | 'strict';
  private readonly cookieDomain: string | undefined;

  constructor(cfg: ConfigService) {
    this.secret = cfg.getOrThrow('CSRF_SECRET');
    this.secureCookie = cfg.get('NODE_ENV') === 'production';
    // Cross-domain deployments (Vercel web ↔ Render API) require
    // SameSite=None;Secure or the browser drops the cookie. Set
    // COOKIE_SAMESITE=none in production to enable that.
    const ss = (cfg.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
    this.sameSite = ss === 'none' || ss === 'strict' ? ss : 'lax';
    this.cookieDomain = cfg.get<string>('COOKIE_DOMAIN') || undefined;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const path = req.originalUrl.split('?')[0] ?? req.path;
    if (CsrfMiddleware.EXEMPT_PREFIXES.some((p) => path.startsWith(p))) {
      return next();
    }

    // Issue cookie on safe requests if missing.
    if (CsrfMiddleware.SAFE_METHODS.has(req.method)) {
      if (!req.cookies?.[CsrfMiddleware.COOKIE]) {
        const token = this.mintToken();
        // SameSite=None requires Secure per spec; force it regardless of env.
        const secure = this.secureCookie || this.sameSite === 'none';
        res.cookie(CsrfMiddleware.COOKIE, token, {
          httpOnly: false,           // must be readable by SPA to echo back
          sameSite: this.sameSite,
          secure,
          path: '/',
          domain: this.cookieDomain,
        });
      }
      return next();
    }

    // Bearer-only requests with no cookies bypass CSRF (no ambient auth to abuse).
    const hasCookie = Boolean(req.cookies && Object.keys(req.cookies).length > 0);
    const hasBearer = (req.headers.authorization ?? '').startsWith('Bearer ');
    if (!hasCookie && hasBearer) return next();

    const cookieVal = req.cookies?.[CsrfMiddleware.COOKIE];
    const headerVal = req.headers[CsrfMiddleware.HEADER];
    if (!cookieVal || typeof headerVal !== 'string') {
      throw new ForbiddenException('Missing CSRF token');
    }
    if (!this.constantTimeEq(cookieVal, headerVal) || !this.verifyToken(cookieVal)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    next();
  }

  private mintToken(): string {
    const nonce = randomBytes(24).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(nonce).digest('base64url');
    return `${nonce}.${sig}`;
  }

  private verifyToken(token: string): boolean {
    const dot = token.lastIndexOf('.');
    if (dot < 1) return false;
    const nonce = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', this.secret).update(nonce).digest('base64url');
    return this.constantTimeEq(sig, expected);
  }

  private constantTimeEq(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
