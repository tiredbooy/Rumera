import type { CategoryTreeNode } from "./category"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1"

/**
 * Fetches the full category tree (parent -> children -> grandchildren) from
 * GET /categories/tree. Meant to be called on the server (e.g. app/layout.tsx)
 * and passed down as a prop to <SiteHeader categoryTree={...} />, so the nav
 * renders fully hydrated with no client-side loading flash.
 *
 * NOTE: swap the base URL / fetch call for whatever shared API client you're
 * already using elsewhere (axios instance, fetch wrapper, etc.) — this is a
 * minimal placeholder since that file hasn't been shared yet.
 */
export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const res = await fetch(`${API_BASE_URL}/categories/tree`, {
    next: { revalidate: 300 }, // category structure changes rarely
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch category tree: ${res.status}`)
  }

  return res.json()
}