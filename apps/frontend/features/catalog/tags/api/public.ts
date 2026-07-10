import { apiFetch } from "@/lib/api/client";
import { Tag, TagListParams } from "../types";

export async function fetchTags(params?: TagListParams): Promise<Tag[]> {
  const query = params
    ? `?${new URLSearchParams(params as Record<string, string>)}`
    : "";
  return apiFetch<Tag[]>(`/tags${query}`);
}

export async function fetchTag(id: number): Promise<Tag> {
  return apiFetch<Tag>(`/tags/${id}`);
}

export async function fetchProductTags(productId: number): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/products/${productId}/tags`);
}
