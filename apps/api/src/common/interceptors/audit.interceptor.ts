import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AUDIT_KEY, type AuditMeta } from '../decorators';
import { AuditService } from '../../modules/audit/audit.service';
import type { AuthPrincipal } from '@kincare/shared';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthPrincipal | undefined;
    const params = { ...(req.params ?? {}), ...(req.body ?? {}) };
    const resourceId = meta.resourceIdParam ? params[meta.resourceIdParam] : undefined;
    const patientId = meta.patientIdParam ? params[meta.patientIdParam] : undefined;

    const base = {
      action: meta.action as never,
      resourceType: meta.resourceType,
      resourceId,
      patientId,
      actorUserId: user?.userId,
      actorRole: user?.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id ?? req.headers['x-request-id'],
    };

    return next.handle().pipe(
      tap(() => this.audit.record({ ...base, outcome: 'success' }).catch(() => undefined)),
      catchError((err) => {
        this.audit.record({ ...base, outcome: 'failure', metadata: { error: String(err?.message ?? err) } })
          .catch(() => undefined);
        return throwError(() => err);
      }),
    );
  }
}
