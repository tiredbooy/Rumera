import type { CategoryTree } from "./types";

export function getCategoryHref(
  category: Pick<CategoryTree, "slug">,
): string | null {
  const slug = category.slug?.trim();
  return slug ? `/categories/${encodeURIComponent(slug)}` : null;
}

export function countRouteableCategories(categories: CategoryTree[]): number {
  return categories.reduce(
    (count, category) =>
      count +
      (getCategoryHref(category) ? 1 : 0) +
      countRouteableCategories(category.children ?? []),
    0,
  );
}

export type CategoryTreeContext = {
  ancestors: CategoryTree[];
  category: CategoryTree;
};

export function findCategoryContext(
  categories: CategoryTree[],
  categoryID: number,
): CategoryTreeContext | null {
  function visit(
    nodes: CategoryTree[],
    ancestors: CategoryTree[],
    seen: Set<number>,
  ): CategoryTreeContext | null {
    for (const category of nodes) {
      if (seen.has(category.id)) continue;
      if (category.id === categoryID) return { ancestors, category };

      const branchSeen = new Set(seen);
      branchSeen.add(category.id);
      const found = visit(
        category.children ?? [],
        [...ancestors, category],
        branchSeen,
      );
      if (found) return found;
    }
    return null;
  }

  return visit(categories, [], new Set());
}
