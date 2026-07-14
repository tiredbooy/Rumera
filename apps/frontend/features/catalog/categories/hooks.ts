"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchCategoryTree } from "./client";

const categoryTreeQueryKey = ["categories", "tree"] as const;

/** Client-side category tree access for interactive category surfaces. */
export function useCategoryTree() {
  return useQuery({
    queryKey: categoryTreeQueryKey,
    queryFn: fetchCategoryTree,
    staleTime: 5 * 60 * 1000,
  });
}
