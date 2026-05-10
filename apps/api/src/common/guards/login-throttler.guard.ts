import {
  CanActivate, ExecutionContext, Inject, Injectable, HttpException, HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Per-IP + per-email sliding-window login throttle backed by Redis.
 *
 * Apply to /auth/login. Tracks two counters:
 *   - `kincare:login:ip:<ip>`     — global per source address
 *   - `kincare:login:email:<lc>`  — per identity (defends shared NATs)
 *
 * Either counter exceeding its limit yields 429 with a Retry-After header.
 * Counters use Redis INCR + EXPIRE for an atomic fixed window. The window
 * length is `LOGIN_RATE_LIMIT_WINDOW_S` and the max is `LOGIN_RATE_LIMIT_MAX`.
 */
@Injectable()
export class LoginThrottlerGuard implements CanActivate {
  private readonly windowSec: number;
  private readonly maxPerIp: number;
  private readonly maxPerEmail: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    cfg: ConfigService,
  ) {
    this.windowSec = Number(cfg.get('LOGIN_RATE_LIMIT_WINDOW_S') ?? 300);
    this.maxPerIp = Number(cfg.get('LOGIN_RATE_LIMIT_MAX') ?? 10);
    this.maxPerEmail = Number(cfg.get('LOGIN_RATE_LIMIT_MAX_EMAIL') ?? 5);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = (req.ip ?? req.socket?.remoteAddress ?? 'unknown').replace(/[^a-zA-Z0-9:.\-]/g, '');
    const email = String((req.body?.email ?? '')).toLowerCase().slice(0, 200);

    const ipKey = `kincare:login:ip:${ip}`;
    const emailKey = email ? `kincare:login:email:${email}` : null;

    const pipeline = this.redis.multi().incr(ipKey).expire(ipKey, this.windowSec, 'NX' as never);
    if (emailKey) pipeline.incr(emailKey).expire(emailKey, this.windowSec, 'NX' as never);
    const res = await pipeline.exec();
    const ipCount = Number((res?.[0]?.[1] as number) ?? 0);
    const emailCount = emailKey ? Number((res?.[2]?.[1] as number) ?? 0) : 0;

    if (ipCount > this.maxPerIp || emailCount > this.maxPerEmail) {
      const ttl = await this.redis.ttl(ipKey);
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many login attempts. Please wait before retrying.',
        retryAfterSeconds: Math.max(ttl, 1),
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
