import "server-only";

import type { ApiFetchOptions } from "@/lib/api/client";
import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { publicRequest } from "@/lib/api/public";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { ProductTag, Tag, TagListQuery } from "../types";

const PUBLIC_TAG_OPTIONS: ApiFetchOptions = { cache: "no-store" };

export function listTags(query: TagListQuery = {}): Promise<Paginated<Tag>> {
  return publicRequest<Paginated<Tag>>(
    `/tags${buildQueryString(query)}`,
    PUBLIC_TAG_OPTIONS,
  );
}

export async function getTag(id: number): Promise<Tag | null> {
  try {
    return await publicRequest<Tag>(`/tags/${id}`, PUBLIC_TAG_OPTIONS);
  } catch (error) {
    if (isApiNotFoundError(error)) return null;
    throw error;
  }
}

export async function listAllTags(): Promise<Tag[]> {
  const tags: Tag[] = [];
  let page = 1;

  for (;;) {
    const result = await listTags({
      page,
      limit: 100,
      sortBy: "title",
      orderBy: "asc",
    });
    tags.push(...result.results);
    if (!result.pagination.has_next || result.results.length === 0) return tags;
    page += 1;
  }
}

export function getProductTags(productId: number): Promise<ProductTag[]> {
  return publicRequest<ProductTag[]>(
    `/products/${productId}/tags`,
    PUBLIC_TAG_OPTIONS,
  );
}
