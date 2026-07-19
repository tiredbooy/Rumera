"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  CreateTagInput,
  ProductTagsInput,
  Tag,
  TagListQuery,
  UpdateTagInput,
} from "@/features/catalog/tags/types";

export class TagApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "TagApiError";
  }
}

export const tagKeys = {
  root: ["admin", "tags"] as const,
  lists: () => [...tagKeys.root, "list"] as const,
  list: (query: TagListQuery) => [...tagKeys.lists(), query] as const,
  details: () => [...tagKeys.root, "detail"] as const,
  detail: (id: number) => [...tagKeys.details(), id] as const,
  options: () => [...tagKeys.root, "options"] as const,
};

async function tagRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new TagApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listAdminTags(
  query: TagListQuery = {},
): Promise<Paginated<Tag>> {
  return tagRequest<Paginated<Tag>>(`tags${buildQueryString(query)}`);
}

export function getAdminTag(id: number): Promise<Tag> {
  return tagRequest<Tag>(`tags/${id}`);
}

export function createTag(input: CreateTagInput): Promise<Tag> {
  return tagRequest<Tag>("admin/tags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTag(id: number, input: UpdateTagInput): Promise<Tag> {
  return tagRequest<Tag>(`admin/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTag(id: number): Promise<void> {
  return tagRequest<void>(`admin/tags/${id}`, { method: "DELETE" });
}

export function syncProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<void> {
  return tagRequest<void>(`admin/products/${productId}/tags`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function listAllTags(): Promise<Tag[]> {
  const query = {
    page: 1,
    limit: 100,
    sortBy: "title",
    orderBy: "asc",
  } as const;
  const first = await listAdminTags(query);
  if (first.pagination.total_pages <= 1) return first.results;

  const tags = [...first.results];
  for (let page = 2; page <= first.pagination.total_pages; page += 1) {
    const response = await listAdminTags({ ...query, page });
    tags.push(...response.results);
  }
  return tags;
}

export function useAdminTags(query: TagListQuery) {
  return useQuery({
    queryKey: tagKeys.list(query),
    queryFn: () => listAdminTags(query),
  });
}

export function useAdminTag(id: number) {
  return useQuery({
    queryKey: tagKeys.detail(id),
    queryFn: () => getAdminTag(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useAllTags() {
  return useQuery({
    queryKey: tagKeys.options(),
    queryFn: listAllTags,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTag,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tagKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: tagKeys.options() }),
      ]);
    },
  });
}

export function useUpdateTag(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTagInput) => updateTag(id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tagKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: tagKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: tagKeys.options() }),
      ]);
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTag,
    onSuccess: async (_data, id) => {
      queryClient.removeQueries({ queryKey: tagKeys.detail(id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tagKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: tagKeys.options() }),
      ]);
    },
  });
}
