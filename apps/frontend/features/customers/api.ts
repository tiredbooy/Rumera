import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { AdminUser, UserListItem, UserListQuery } from "./types";

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
