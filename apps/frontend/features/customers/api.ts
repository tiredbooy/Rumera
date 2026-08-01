import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated, PaginationQuery } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  AdminAuthorizationSummary,
  AdminUser,
  AdminUserAuditEvent,
  UserListItem,
  UserListQuery,
} from "./types";

export function getAdminRoles(): Promise<AdminAuthorizationSummary> {
  return apiFetch<AdminAuthorizationSummary>("/admin/roles");
}

export function listUsers(
  query: UserListQuery = {},
): Promise<Paginated<UserListItem>> {
  return apiFetch<Paginated<UserListItem>>(
    `/admin/users${buildQueryString(query)}`,
  );
}

export function getAdminUser(userID: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${userID}`);
}

export function getAdminUserAudit(
  userID: string,
  query: PaginationQuery = {},
): Promise<Paginated<AdminUserAuditEvent>> {
  return apiFetch<Paginated<AdminUserAuditEvent>>(
    `/admin/users/${userID}/audit${buildQueryString(query)}`,
  );
}
