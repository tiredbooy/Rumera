"use client"

import { useQuery } from "@tanstack/react-query"
import { getCategoryTree } from "./categories"

/**
 * Client-side variant of getCategoryTree. The header itself does NOT use
 * this — it receives categoryTree as a server-fetched prop so nav never
 * shows a loading state. This hook is for client contexts where refetching/
 * caching behavior is worth the extra round trip, e.g. a standalone
 * /categories browser page.
 */
export function useCategoryTree() {
  return useQuery({
    queryKey: ["categories", "tree"],
    queryFn: getCategoryTree,
    staleTime: 5 * 60 * 1000,
  })
}