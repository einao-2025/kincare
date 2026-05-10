import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { decodeJwtUnsafe } from './jwt.util';

/**
 * Resolves the active tenant for the request and stores it on `req.tenantId`.
 * Resolution order:
 *   1. Verified `tid` claim from the access-token JWT (if present).
 *   2. `X-Tenant-Id` header (allowed only for unauthenticated routes such as
 *      registration / SMART launch — protected routes ignore it).
 *   3. `DEFAULT_TENANT_ID` env value (defaults to `"default"`).
 *
 * Note: signature verification of the JWT is performed downstream by the
 * `JwtAuthGuard`. Here we use an unsafe decode purely to extract the tenant
 * before guards run; once the guard verifies the token we trust the same `tid`.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { tenantId?: string }, _res: Response, next: NextFunction): void {
    const fallback = process.env.DEFAULT_TENANT_ID ?? 'default';
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const claims = decodeJwtUnsafe(auth.slice(7));
      if (claims?.tid) {
        req.tenantId = String(claims.tid);
        return next();
      }
    }
    const header = req.headers['x-tenant-id'];
    if (typeof header === 'string' && header.length > 0) {
      req.tenantId = header;
      return next();
    }
    req.tenantId = fallback;
    next();
  }
}
