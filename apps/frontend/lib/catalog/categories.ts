/**
 * Public category fetchers (server-side, ISR-cached, error-safe). See
 * `products.ts` for the same resilience contract.
 */
import { buildQuery } from "@/lib/api/qs"
import type { Paginated, Category } from "./types"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listCategories(): Promise<Category[]> {
  const body = await publicGet<Paginated<Category>>(`/categories${buildQuery({ limit: 100 })}`)
  return body?.results ?? []
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const all = await listCategories()
  return all.find((c) => c.slug === slug) ?? null
}

export async function categoryTree(): Promise<Category[]> {
  const body = await publicGet<{ data: Category[] }>(`/categories/tree`)
  return body?.data ?? []
}
