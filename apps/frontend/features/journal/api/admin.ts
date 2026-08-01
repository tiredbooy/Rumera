import "server-only";

import { apiFetch } from "@/lib/api/client";
import { buildQuery } from "@/lib/api/qs";
import type { Paginated } from "@/lib/api/types";

import type {
  AdminJournalListQuery,
  JournalCategory,
  JournalDetail,
  JournalListItem,
} from "../types";

export function listAdminJournalPosts(
  query: AdminJournalListQuery = {},
): Promise<Paginated<JournalListItem>> {
  return apiFetch<Paginated<JournalListItem>>(
    `/admin/blogs${buildQuery({ ...query })}`,
  );
}

export function getAdminJournalPost(id: number): Promise<JournalDetail> {
  return apiFetch<JournalDetail>(`/admin/blogs/${id}`);
}

export function listAdminJournalCategories(): Promise<JournalCategory[]> {
  return apiFetch<JournalCategory[]>("/admin/blog-categories");
}

export function getAdminJournalCategory(id: number): Promise<JournalCategory> {
  return apiFetch<JournalCategory>(`/admin/blog-categories/${id}`);
}
