import type { PaginationQuery } from "@/lib/api/types";
import type { UserGender } from "@/features/profile/types";
import type { Role } from "@/lib/rbac/roles";

export type { UserGender } from "@/features/profile/types";

export type AdminUserRole = Role;

export interface AdminRoleSummaryItem {
  role: AdminUserRole;
  admin_access: boolean;
  assignable: boolean;
  member_count: number;
  active_member_count: number;
}

export interface AdminAuthorizationSummary {
  /** `role_capabilities` once server RBAC is live; legacy `single_role` tolerated. */
  authorization_mode: "single_role" | "role_capabilities";
  admin_roles: AdminUserRole[];
  roles: AdminRoleSummaryItem[];
}

export interface AdminUser {
  user_id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  birth_date?: string;
  gender?: UserGender;
  role: AdminUserRole;
  created_at: string;
  national_code?: string;
  oauth_provider?: string;
  is_active: boolean;
  is_banned: boolean;
  banned_at?: string;
  email_verified_at?: string;
  last_login_at?: string;
  updated_at: string;
}

export interface UserListItem {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: AdminUserRole;
  total_orders: number;
  is_active: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface AdminUserUpdateInput {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  national_code?: string | null;
  birth_date?: string | null;
  gender?: UserGender | null;
  role?: AdminUserRole;
  is_active?: boolean;
}

export interface AdminUserCreateInput {
  email: string;
  password: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  national_code?: string | null;
  birth_date?: string | null;
  gender?: UserGender | null;
  role?: AdminUserRole;
  is_active?: boolean;
}

export type AdminUserAuditAction =
  | "user.created"
  | "user.updated"
  | "user.deactivated";

export interface AdminUserAuditChange {
  before: unknown;
  after: unknown;
}

export interface AdminUserAuditEvent {
  event_id: string;
  actor_user_id: string;
  actor_email: string;
  target_user_id: string;
  action: AdminUserAuditAction;
  changed_fields: string[];
  changes: Record<string, AdminUserAuditChange>;
  created_at: string;
}

export type UserListSortField =
  | "created_at"
  | "email"
  | "first_name"
  | "last_name";
export type UserListSortDirection = "asc" | "desc";

export interface UserListQuery extends PaginationQuery {
  sortBy?: UserListSortField;
  orderBy?: UserListSortDirection;
  search?: string;
  role?: AdminUserRole;
  is_active?: boolean;
  gender?: UserGender;
  created_from?: string;
  created_to?: string;
}

export type UserStatusFilter = "all" | "active" | "inactive";

export interface UserListFilters {
  query: string;
  page: number;
  role?: AdminUserRole;
  status: UserStatusFilter;
}

export type UserListSearchParams = {
  q?: string | string[];
  page?: string | string[];
  role?: string | string[];
  status?: string | string[];
};

export type UserDetailSearchParams = {
  audit_page?: string | string[];
};
