import { apiFetch } from "@/lib/api/client";
import {
  Tag,
  CreateTagInput,
  UpdateTagInput,
  ProductTagsInput,
} from "../types";

// Tag CRUD

export async function createTag(input: CreateTagInput): Promise<Tag> {
  return apiFetch<Tag>("/tags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTag(
  id: number,
  input: UpdateTagInput,
): Promise<Tag> {
  return apiFetch<Tag>(`/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteTag(id: number): Promise<void> {
  return apiFetch<void>(`/tags/${id}`, { method: "DELETE" });
}

// Product tag assignment

export async function attachProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/products/${productId}/tags`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function syncProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<Tag[]> {
  return apiFetch<Tag[]>(`/products/${productId}/tags`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function detachProductTags(
  productId: number,
  input: ProductTagsInput,
): Promise<void> {
  return apiFetch<void>(`/products/${productId}/tags`, {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
