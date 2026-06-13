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
  orders: {
    all: ["orders"] as const,
    list: (params?: Record<string, unknown>) => ["orders", "list", params ?? {}] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  customers: {
    all: ["customers"] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
  },
  cart: ["cart"] as const,
  wishlist: ["wishlist"] as const,
  wallet: ["wallet"] as const,
  addresses: ["addresses"] as const,
  recommendations: ["recommendations"] as const,
  analytics: (range?: string) => ["analytics", range ?? "30d"] as const,
} as const
