import { Injectable, Scope } from '@nestjs/common';

/**
 * Request-scoped tenant context. Populated by {@link TenantMiddleware} from
 * either the JWT (`tid` claim) or the `X-Tenant-Id` header for unauth flows
 * (e.g. registration / SMART app launch). Services consult `tenantId` to
 * scope queries; nothing is written without it once multi-tenancy is enabled.
 *
 * Default tenant id (`default`) is used during single-tenant deployments so
 * existing code keeps working unchanged.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private _tenantId: string = process.env.DEFAULT_TENANT_ID ?? 'default';

  get tenantId(): string {
    return this._tenantId;
  }

  set tenantId(value: string) {
    if (!value) return;
    this._tenantId = value;
  }
}
