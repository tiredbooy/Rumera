/**
 * React Query key factories. Using a single source for keys keeps cache
 * invalidation predictable across the app (TanStack Query is configured in
 * `app/providers.tsx`).
 */
export const queryKeys = {
  products: {
    all: ["products"] as const,
    list: (params?: Record<string, unknown>) => ["products", "list", params ?? {}] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
  },
  cart: ["cart"] as const,
  addresses: ["addresses"] as const,
} as const
