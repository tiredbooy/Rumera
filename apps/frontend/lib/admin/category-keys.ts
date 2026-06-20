/**
 * TanStack Query key for the admin category tree. Kept in its own module so the
 * list view and the create/edit forms invalidate the exact same cache entry
 * after a mutation.
 */
export const CATEGORIES_QUERY_KEY = ["admin", "categories", "tree"] as const
