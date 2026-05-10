import { SetMetadata } from '@nestjs/common';
import type { Permission, Role } from '@kincare/shared';

export const ROLES_KEY = 'roles';
export const PERMS_KEY = 'permissions';
export const PUBLIC_KEY = 'isPublic';
export const MFA_REQUIRED_KEY = 'mfaRequired';
export const AUDIT_KEY = 'auditMeta';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);
export const RequireMfa = () => SetMetadata(MFA_REQUIRED_KEY, true);

export interface AuditMeta {
  action: string;
  resourceType: string;
  /** Property of route params/body to use as resourceId, e.g. "id". */
  resourceIdParam?: string;
  /** Property of route params/body to use as patientId. */
  patientIdParam?: string;
}
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
