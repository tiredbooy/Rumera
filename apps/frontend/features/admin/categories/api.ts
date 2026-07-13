import { apiFetch } from "@/lib/api/client";
import type {
  Category,
  CategoryTree,
} from "@/features/catalog/categories/types";

export function getCategory(id: number | string): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`);
}

export function getCategoryTree(): Promise<CategoryTree[]> {
  return apiFetch<CategoryTree[]>("/categories/tree");
}
