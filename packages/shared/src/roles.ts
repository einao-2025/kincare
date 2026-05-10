/**
 * Canonical role identifiers — kept in sync with Prisma `UserRole` enum.
 * Duplicated here so non-DB packages don't pull a Prisma dependency.
 */
export const Roles = {
  PATIENT: 'PATIENT',
  FAMILY_DELEGATE: 'FAMILY_DELEGATE',
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSE',
  PHARMACIST: 'PHARMACIST',
  LAB_TECHNICIAN: 'LAB_TECHNICIAN',
  RADIOLOGIST: 'RADIOLOGIST',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ALL_ROLES: Role[] = Object.values(Roles);

export const STAFF_ROLES: Role[] = [
  Roles.DOCTOR,
  Roles.NURSE,
  Roles.PHARMACIST,
  Roles.LAB_TECHNICIAN,
  Roles.RADIOLOGIST,
  Roles.HOSPITAL_ADMIN,
  Roles.SUPER_ADMIN,
];

export const PATIENT_FACING_ROLES: Role[] = [Roles.PATIENT, Roles.FAMILY_DELEGATE];
