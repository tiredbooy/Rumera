import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { Tag, TagListQuery } from "../types";

export function listTags(
  query: TagListQuery = {},
): Promise<Paginated<Tag>> {
  return apiFetch<Paginated<Tag>>(`/tags${buildQueryString(query)}`);
}

export function getTag(id: number): Promise<Tag> {
  return apiFetch<Tag>(`/tags/${id}`);
}

export function getProductTags(productId: number): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/products/${productId}/tags`);
}
