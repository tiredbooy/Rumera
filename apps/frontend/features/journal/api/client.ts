"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { buildQuery } from "@/lib/api/qs";
import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";

import type {
  AdminJournalListQuery,
  CreateJournalCategoryInput,
  CreateJournalPostInput,
  JournalCategory,
  JournalDetail,
  JournalListItem,
  UpdateJournalCategoryInput,
  UpdateJournalPostInput,
} from "../types";

export class JournalApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "JournalApiError";
  }
}

async function journalRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new JournalApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export const journalAdminKeys = {
  root: ["admin", "journal"] as const,
  lists: () => [...journalAdminKeys.root, "list"] as const,
  list: (query: AdminJournalListQuery) =>
    [...journalAdminKeys.lists(), query] as const,
  details: () => [...journalAdminKeys.root, "detail"] as const,
  detail: (id: number) => [...journalAdminKeys.details(), id] as const,
  categories: () => [...journalAdminKeys.root, "categories"] as const,
  category: (id: number) =>
    [...journalAdminKeys.categories(), "detail", id] as const,
};

export function listAdminJournalPosts(
  query: AdminJournalListQuery = {},
): Promise<Paginated<JournalListItem>> {
  return journalRequest<Paginated<JournalListItem>>(
    `admin/blogs${buildQuery({ ...query })}`,
  );
}

export function getAdminJournalPost(id: number): Promise<JournalDetail> {
  return journalRequest<JournalDetail>(`admin/blogs/${id}`);
}

export function createJournalPost(
  input: CreateJournalPostInput,
): Promise<JournalDetail> {
  return journalRequest<JournalDetail>("admin/blogs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateJournalPost(
  id: number,
  input: UpdateJournalPostInput,
): Promise<JournalDetail> {
  return journalRequest<JournalDetail>(`admin/blogs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteJournalPost(id: number): Promise<void> {
  return journalRequest<void>(`admin/blogs/${id}`, { method: "DELETE" });
}

export function listAdminJournalCategories(): Promise<JournalCategory[]> {
  return journalRequest<JournalCategory[]>("admin/blog-categories");
}

export function getAdminJournalCategory(id: number): Promise<JournalCategory> {
  return journalRequest<JournalCategory>(`admin/blog-categories/${id}`);
}

export function createJournalCategory(
  input: CreateJournalCategoryInput,
): Promise<JournalCategory> {
  return journalRequest<JournalCategory>("admin/blog-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateJournalCategory(
  id: number,
  input: UpdateJournalCategoryInput,
): Promise<JournalCategory> {
  return journalRequest<JournalCategory>(`admin/blog-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteJournalCategory(id: number): Promise<void> {
  return journalRequest<void>(`admin/blog-categories/${id}`, {
    method: "DELETE",
  });
}

export function useAdminJournalPosts(query: AdminJournalListQuery) {
  return useQuery({
    queryKey: journalAdminKeys.list(query),
    queryFn: () => listAdminJournalPosts(query),
  });
}

export function useAdminJournalCategories() {
  return useQuery({
    queryKey: journalAdminKeys.categories(),
    queryFn: listAdminJournalCategories,
  });
}

export function useUpdateJournalPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateJournalPostInput;
    }) => updateJournalPost(id, input),
    onSuccess: async (post) => {
      queryClient.setQueryData(journalAdminKeys.detail(post.id), post);
      await queryClient.invalidateQueries({
        queryKey: journalAdminKeys.lists(),
      });
    },
  });
}

export function useDeleteJournalPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteJournalPost,
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: journalAdminKeys.detail(id) });
      await queryClient.invalidateQueries({
        queryKey: journalAdminKeys.lists(),
      });
    },
  });
}

export function useDeleteJournalCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteJournalCategory,
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: journalAdminKeys.category(id) });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: journalAdminKeys.categories(),
        }),
        queryClient.invalidateQueries({ queryKey: journalAdminKeys.lists() }),
      ]);
    },
  });
}
