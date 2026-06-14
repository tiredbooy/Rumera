/**
 * Live journal/blog fetchers (server-side, ISR-cached) backed by the Go blog API.
 *
 * Error-safe (returns sane fallbacks when the backend is unreachable so
 * `next build` and rendering never hard-fail) and ISR-cached.
 *
 *   GET /blogs            → { data } BlogPost[]      (newest first)
 *   GET /blogs/:slug      → { data } BlogDetail      (+categories, product_ids, tag_ids)
 *   GET /blog-categories  → { data } BlogCategory[]
 *
 * The blog model has no cover image, so cards/heroes fall back to SmartImage's
 * branded placeholder. Add a cover-image column later and it lights up for free.
 */
import { faNum } from "@/lib/products"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

export type BlogCategory = {
  id: number
  name: string
  slug: string | null
  description: string | null
  parent_id: number | null
}

export type BlogPost = {
  id: number
  author_id: number
  title: string
  slug: string
  content: string
  excerpt: string | null
  time_to_read: number
  total_reads: number
  meta_title: string | null
  meta_description: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type BlogDetail = BlogPost & {
  categories: BlogCategory[]
  product_ids: number[]
  tag_ids: number[]
}

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function unwrap<T>(body: { data?: T[] } | T[] | null): T[] {
  if (!body) return []
  return Array.isArray(body) ? body : (body.data ?? [])
}

/** Visible if not a draft (has a publish date) and not future-dated. */
function isVisible(p: BlogPost): boolean {
  if (!p.published_at) return true // backend lists it → treat as visible
  return new Date(p.published_at).getTime() <= Date.now()
}

function sortByDateDesc(a: BlogPost, b: BlogPost): number {
  const da = new Date(a.published_at ?? a.created_at).getTime()
  const db = new Date(b.published_at ?? b.created_at).getTime()
  return db - da
}

export async function listBlogs(): Promise<BlogPost[]> {
  const posts = unwrap<BlogPost>(await publicGet("/blogs"))
  return posts.filter(isVisible).sort(sortByDateDesc)
}

export async function getBlogBySlug(slug: string): Promise<BlogDetail | null> {
  const body = await publicGet<{ data?: BlogDetail } | BlogDetail>(`/blogs/${encodeURIComponent(slug)}`)
  if (!body) return null
  const post = "data" in (body as { data?: BlogDetail }) ? (body as { data?: BlogDetail }).data : (body as BlogDetail)
  return post && post.id ? post : null
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  return unwrap<BlogCategory>(await publicGet("/blog-categories"))
}

/** Other recent posts for the "more from the journal" rail. */
export async function getRelatedBlogs(excludeSlug: string, limit = 3): Promise<BlogPost[]> {
  const posts = await listBlogs()
  return posts.filter((p) => p.slug !== excludeSlug).slice(0, limit)
}

export async function allBlogSlugs(): Promise<string[]> {
  const posts = await listBlogs()
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

export function readingTime(minutes: number): string {
  return `${faNum(minutes || 1)} دقیقه مطالعه`
}
