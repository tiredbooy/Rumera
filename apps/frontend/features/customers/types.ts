import type { PaginationQuery } from "@/lib/api/types";
import type { UserGender } from "@/features/profile/types";

export type { UserGender } from "@/features/profile/types";

export type AdminUserRole = "customer" | "admin" | "vendor";

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
