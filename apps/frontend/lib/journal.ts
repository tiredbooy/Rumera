/**
 * Live journal/blog fetchers (server-side, ISR-cached) backed by the Go blog API.
 *
 * Wave-1 backend contract (this file mirrors it exactly):
 *
 *   GET /blogs            → { results: BlogListItem[], pagination }  (PUBLISHED-only, paginated)
 *   GET /blogs/:slug      → { data: BlogDetail }                     (drafts 404)
 *   GET /blog-categories  → { data: BlogCategory[] }
 *
 * The public listing is now a paginated envelope (`results` + `pagination`),
 * published-only, and every post carries a cover image (`image_url`, may be
 * null) plus `is_featured` / `status` / `published_at`. Cards/heroes render the
 * cover via `next/image` and fall back to a branded gradient when it's missing.
 *
 * Every fetcher is error-safe (returns sane fallbacks when the backend is
 * unreachable so `next build` and rendering never hard-fail) and ISR-cached.
 */
import { faNum } from "@/lib/products"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

export type BlogStatus = "draft" | "published" | "archived"

export type BlogCategory = {
  id: number
  name: string
  slug: string | null
  description: string | null
  parent_id: number | null
}

/** Lightweight card payload from the paginated `/blogs` listing (no content body). */
export type BlogListItem = {
  id: number
  author_id: number
  title: string
  slug: string
  excerpt: string | null
  image_url: string | null
  time_to_read: number
  total_reads: number
  status: BlogStatus
  is_featured: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

/** Full article payload from `/blogs/:slug` (adds content body + meta + relations). */
export type BlogDetail = BlogListItem & {
  content: string
  meta_title: string | null
  meta_description: string | null
  categories: BlogCategory[]
  product_ids: number[]
  tag_ids: number[]
}

/** Server-side pagination envelope returned alongside `results`. */
export type Pagination = {
  page: number
  limit: number
  total_items: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export type BlogListResult = {
  posts: BlogListItem[]
  pagination: Pagination
}

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total_items: 0,
  total_pages: 1,
  has_next: false,
  has_prev: false,
}

type PaginatedEnvelope<T> = { results?: T[]; pagination?: Pagination }

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Fetch one page of the (published-only) journal listing. Reads `results`
 * (NOT `data`) and consumes the `pagination` envelope. Returns an empty,
 * well-formed result when the backend is unreachable.
 */
export async function listBlogs(
  opts: { page?: number; limit?: number } = {}
): Promise<BlogListResult> {
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 24))
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  const body = await publicGet<PaginatedEnvelope<BlogListItem>>(`/blogs?${qs.toString()}`)
  const posts = body?.results ?? []
  const pagination = body?.pagination ?? { ...EMPTY_PAGINATION, page, limit }
  return { posts, pagination }
}

/** First page only — convenience for surfaces that just need the cards. */
export async function listBlogPosts(limit = 24): Promise<BlogListItem[]> {
  return (await listBlogs({ limit })).posts
}

export async function getBlogBySlug(slug: string): Promise<BlogDetail | null> {
  const body = await publicGet<{ data?: BlogDetail }>(`/blogs/${encodeURIComponent(slug)}`)
  const post = body?.data
  return post && post.id ? post : null
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const body = await publicGet<{ data?: BlogCategory[] }>("/blog-categories")
  return body?.data ?? []
}

/** Other recent posts for the "more from the journal" rail. */
export async function getRelatedBlogs(excludeSlug: string, limit = 3): Promise<BlogListItem[]> {
  const { posts } = await listBlogs({ limit: limit + 4 })
  return posts.filter((p) => p.slug !== excludeSlug).slice(0, limit)
}

export async function allBlogSlugs(): Promise<string[]> {
  const { posts } = await listBlogs({ limit: 100 })
  return posts.map((p) => p.slug)
}

// ── Display helpers ────────────────────────────────────────────────────────────

const jalali = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" })

/** ISO date → Persian (Jalali) long date. */
export function formatBlogDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : jalali.format(d)
}

/** "۶ دقیقه مطالعه" — reading time as a localized, human label. */
export function readingTime(minutes: number): string {
  return `${faNum(minutes || 1)} دقیقه مطالعه`
}
