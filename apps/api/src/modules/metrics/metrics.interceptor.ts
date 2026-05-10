import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Records HTTP request duration into the Prometheus histogram. Skips the
 * /metrics scrape endpoint itself to avoid feedback loops.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (req.path === '/metrics') return next.handle();
    const start = process.hrtime.bigint();

    return next.handle().pipe(tap({
      next: () => this.observe(req, res, start),
      error: () => this.observe(req, res, start),
    }));
  }

  private observe(req: Request, res: Response, start: bigint): void {
    const route = (req.route?.path as string | undefined) ?? req.path;
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    this.metrics.httpRequestDuration.labels(
      req.method,
      route,
      String(res.statusCode),
    ).observe(seconds);
  }
}
