import type { Permission } from './permissions';
import type { Role } from './roles';

/** Authenticated request principal carried via JWT and request context. */
export interface AuthPrincipal {
  userId: string;
  role: Role;
  email: string;
  sessionId: string;
  /** Pre-computed static permissions (role-based). Runtime grants are checked separately. */
  permissions: Permission[];
  mfaVerified: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
