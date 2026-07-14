import type { CategoryTree } from "./types";

export function getCategoryHref(category: CategoryTree): string | null {
  return category.slug
    ? `/categories/${encodeURIComponent(category.slug)}`
    : null;
}
