/** Minimal category shape needed to label a flat id-select. */
export type CategorySelectSource = {
  id: number;
  title: string;
  parent_id?: number | null;
};

const PATH_SEPARATOR = " / ";

/**
 * Walk `parent_id` ancestors into `Parent / Child`. Cycle-safe.
 * Missing parents (lookup page of 100) fall back to the title alone.
 */
export function categoryPathLabel(
  category: CategorySelectSource,
  byId: Map<number, CategorySelectSource>,
  visiting: Set<number> = new Set(),
): string {
  if (visiting.has(category.id)) {
    return category.title;
  }

  visiting.add(category.id);

  const parentId = category.parent_id;
  if (parentId == null) {
    return category.title;
  }

  const parent = byId.get(parentId);
  if (!parent || visiting.has(parent.id)) {
    return category.title;
  }

  return `${categoryPathLabel(parent, byId, visiting)}${PATH_SEPARATOR}${category.title}`;
}

/** SearchableIdSelect options; ids are unchanged, only `title` is hierarchical. */
export function categorySelectOptions(
  categories: CategorySelectSource[],
): Array<{ id: number; title: string }> {
  const byId = new Map<number, CategorySelectSource>();
  for (const category of categories) {
    byId.set(category.id, category);
  }

  return categories.map((category) => ({
    id: category.id,
    title: categoryPathLabel(category, byId),
  }));
}
