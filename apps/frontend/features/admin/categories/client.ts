"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types";
import type {
  Category,
  CategoryTree,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/features/catalog/categories/types";

export class CategoryApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "CategoryApiError";
  }
}

async function categoryRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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
    throw new CategoryApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function getCategoryTree(): Promise<CategoryTree[]> {
  return categoryRequest<CategoryTree[]>("categories/tree");
}

export function createCategory(input: CreateCategoryInput): Promise<Category> {
  return categoryRequest<Category>("admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  id: number,
  input: UpdateCategoryInput,
): Promise<Category> {
  return categoryRequest<Category>(`admin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCategory(id: number): Promise<void> {
  return categoryRequest<void>(`admin/categories/${id}`, { method: "DELETE" });
}
