// api/categories.ts
import { BASE_API_URL } from "@/lib/utils/api-helpers";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  CategoryResponse,
  CategoryTree,
  CreateCategoryReq,
  UpdateCategoryReq,
  CategoryFilter,
} from "./types";

// ── Public ────────────────────────────────────

export async function fetchCategories(filter: CategoryFilter = {}) {
  const qs = buildQueryString(filter as Record<string, unknown>);
  const res = await fetch(`${BASE_API_URL}/categories${qs}`);
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.statusText}`);
  return res.json() as Promise<{ results: CategoryResponse[]; total: number }>;
}

export async function fetchCategoryTree() {
  const res = await fetch(`${BASE_API_URL}/categories/tree`);
  if (!res.ok)
    throw new Error(`Failed to fetch category tree: ${res.statusText}`);
  const data = await res.json();
  return data?.data as Promise<CategoryTree[]>;
}

export async function fetchFeaturedCategories() {
  const res = await fetch(`${BASE_API_URL}/categories/featured`);
  if (!res.ok)
    throw new Error(`Failed to fetch featured categories: ${res.statusText}`);
  const data = await res.json();
  return data?.data as Promise<CategoryResponse[]>;
}

export async function fetchCategory(id: number) {
  const res = await fetch(`${BASE_API_URL}/categories/${id}`);
  if (!res.ok)
    throw new Error(`Failed to fetch category ${id}: ${res.statusText}`);
  return res.json() as Promise<CategoryResponse>;
}

export async function fetchCategoryChildren(id: number) {
  const res = await fetch(`${BASE_API_URL}/categories/${id}/children`);
  if (!res.ok)
    throw new Error(`Failed to fetch children of ${id}: ${res.statusText}`);
  return res.json() as Promise<CategoryResponse[]>;
}

// ── Admin ─────────────────────────────────────

export async function createCategory(data: CreateCategoryReq) {
  const res = await fetch(`${BASE_API_URL}/admin/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create category: ${res.statusText}`);
  return res.json() as Promise<CategoryResponse>;
}

export async function updateCategory(id: number, data: UpdateCategoryReq) {
  const res = await fetch(`${BASE_API_URL}/admin/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok)
    throw new Error(`Failed to update category ${id}: ${res.statusText}`);
  return res.json() as Promise<CategoryResponse>;
}

export async function deleteCategory(id: number) {
  const res = await fetch(`${BASE_API_URL}/admin/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok)
    throw new Error(`Failed to delete category ${id}: ${res.statusText}`);
}
