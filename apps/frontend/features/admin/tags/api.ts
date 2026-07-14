import { apiFetch } from "@/lib/api/client";
import type {
  CreateTagInput,
  ProductTagsInput,
  Tag,
  UpdateTagInput,
} from "@/features/catalog/tags/types";

export function createTag(input: CreateTagInput): Promise<Tag> {
  return apiFetch<Tag>("/admin/tags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTag(
  id: number,
  input: UpdateTagInput,
): Promise<Tag> {
  return apiFetch<Tag>(`/admin/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTag(id: number): Promise<void> {
  return apiFetch<void>(`/admin/tags/${id}`, { method: "DELETE" });
}

export function attachProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<void> {
  return apiFetch<void>(`/admin/products/${productId}/tags`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function syncProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<void> {
  return apiFetch<void>(`/admin/products/${productId}/tags`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function detachProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<void> {
  return apiFetch<void>(`/admin/products/${productId}/tags`, {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
