import { Roles, type Role } from './roles';

/**
 * Action-based permission tokens used by the RBAC guard.
 * Format: <resource>:<action>
 */
export const Permissions = {
  // Patient profile
  PATIENT_READ_OWN: 'patient:read:own',
  PATIENT_READ_ANY: 'patient:read:any',
  PATIENT_UPDATE_OWN: 'patient:update:own',
  PATIENT_UPDATE_ANY: 'patient:update:any',

  // Medical history
  HISTORY_READ_OWN: 'history:read:own',
  HISTORY_READ_ANY: 'history:read:any',
  HISTORY_WRITE: 'history:write',

  // Prescriptions
  RX_READ_OWN: 'rx:read:own',
  RX_READ_ANY: 'rx:read:any',
  RX_PRESCRIBE: 'rx:prescribe',
  RX_REFILL_REQUEST: 'rx:refill:request',
  RX_REFILL_APPROVE: 'rx:refill:approve',
  RX_DISPENSE: 'rx:dispense',
  RX_AUTHORIZE_PICKUP: 'rx:pickup:authorize',

  // Test results / DiagnosticReport
  RESULTS_READ_OWN: 'results:read:own',
  RESULTS_READ_ANY: 'results:read:any',
  RESULTS_UPLOAD: 'results:upload',
  RESULTS_FINALIZE: 'results:finalize',

  // DICOM
  DICOM_READ_OWN: 'dicom:read:own',
  DICOM_READ_ANY: 'dicom:read:any',
  DICOM_UPLOAD: 'dicom:upload',

  // Family / consent
  FAMILY_INVITE: 'family:invite',
  FAMILY_MANAGE: 'family:manage',
  CONSENT_MANAGE_OWN: 'consent:manage:own',

  // Notifications
  NOTIF_SEND: 'notification:send',

  // Audit
  AUDIT_READ: 'audit:read',

  // Admin
  ADMIN_USERS: 'admin:users',
  ADMIN_SYSTEM: 'admin:system',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

const P = Permissions;

/** Static role → permission matrix. Delegate-grant scopes are layered on top at runtime. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Roles.PATIENT]: [
    P.PATIENT_READ_OWN, P.PATIENT_UPDATE_OWN,
    P.HISTORY_READ_OWN,
    P.RX_READ_OWN, P.RX_REFILL_REQUEST, P.RX_AUTHORIZE_PICKUP,
    P.RESULTS_READ_OWN,
    P.DICOM_READ_OWN,
    P.FAMILY_INVITE, P.FAMILY_MANAGE,
    P.CONSENT_MANAGE_OWN,
  ],
  [Roles.FAMILY_DELEGATE]: [
    // Granular access is enforced via PermissionGrant scopes at runtime.
  ],
  [Roles.DOCTOR]: [
    P.PATIENT_READ_ANY, P.PATIENT_UPDATE_ANY,
    P.HISTORY_READ_ANY, P.HISTORY_WRITE,
    P.RX_READ_ANY, P.RX_PRESCRIBE, P.RX_REFILL_APPROVE,
    P.RESULTS_READ_ANY, P.RESULTS_UPLOAD, P.RESULTS_FINALIZE,
    P.DICOM_READ_ANY,
    P.NOTIF_SEND,
  ],
  [Roles.NURSE]: [
    P.PATIENT_READ_ANY,
    P.HISTORY_READ_ANY,
    P.RX_READ_ANY,
    P.RESULTS_READ_ANY,
    P.NOTIF_SEND,
  ],
  [Roles.PHARMACIST]: [
    P.RX_READ_ANY, P.RX_REFILL_APPROVE, P.RX_DISPENSE,
    P.PATIENT_READ_ANY,
  ],
  [Roles.LAB_TECHNICIAN]: [
    P.PATIENT_READ_ANY,
    P.RESULTS_UPLOAD, P.RESULTS_READ_ANY,
  ],
  [Roles.RADIOLOGIST]: [
    P.PATIENT_READ_ANY,
    P.DICOM_READ_ANY, P.DICOM_UPLOAD,
    P.RESULTS_UPLOAD, P.RESULTS_FINALIZE,
  ],
  [Roles.HOSPITAL_ADMIN]: [
    P.PATIENT_READ_ANY,
    P.AUDIT_READ,
    P.ADMIN_USERS,
    P.RESULTS_UPLOAD,
  ],
  [Roles.SUPER_ADMIN]: Object.values(P),
};

/**
 * Maps a delegate's PermissionGrant scope to runtime permission tokens.
 * The actual scope strings come from Prisma `PermissionScope` enum.
 */
export const SCOPE_TO_PERMISSIONS: Record<string, Permission[]> = {
  VIEW_DEMOGRAPHICS: [P.PATIENT_READ_ANY],
  VIEW_MEDICAL_HISTORY: [P.HISTORY_READ_ANY],
  VIEW_PRESCRIPTIONS: [P.RX_READ_ANY],
  REQUEST_REFILL: [P.RX_REFILL_REQUEST],
  AUTHORIZE_PICKUP: [P.RX_AUTHORIZE_PICKUP],
  VIEW_TEST_RESULTS: [P.RESULTS_READ_ANY],
  VIEW_IMAGING: [P.DICOM_READ_ANY],
  RECEIVE_PROGRESS_UPDATES: [],
  EMERGENCY_ACCESS: [P.PATIENT_READ_ANY, P.HISTORY_READ_ANY, P.RESULTS_READ_ANY],
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
