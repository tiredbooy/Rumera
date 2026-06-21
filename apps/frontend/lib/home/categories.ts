/**
 * Storefront home category fetcher (server-side, ISR-cached, error-safe).
 *
 * Mirrors `lib/home/hero.ts`: backed by the Go `GET /categories` endpoint
 * (public, paginated), error-safe so `next build` and rendering never hard-fail,
 * and ISR-cached. Falls back to a curated static set so the home grid always
 * renders something premium even with the backend down or no categories yet.
 *
 * This makes the home "shop by category" section fully data-driven — add a
 * category in the admin dashboard and it shows up here, no code change needed.
 */
import { buildQuery } from "@/lib/api/qs"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

/** A category as the home grid needs it (display-ready). */
export type HomeCategory = {
  id: number | string
  /** Display name (shown on the card). */
  name: string
  /** URL slug — links to `/categories/{slug}` and the image path. */
  slug: string
  /** Short subtitle under the name. */
  tagline: string
}

/** Raw shape returned by `GET /categories` (mirrors the backend CategoryResponse). */
type ApiCategory = {
  id: number
  name: string
  slug?: string | null
  description?: string | null
  parent_id?: number | null
}

/** Latinise a label into a URL-safe slug; non-latin text falls back to empty. */
function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‌\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Curated fallback so the section never renders empty. Mirrors the original
 * hardcoded set; used only when the backend returns nothing or is unreachable.
 */
export const FALLBACK_CATEGORIES: HomeCategory[] = [
  { id: "whisky", name: "ویسکی", slug: "whisky", tagline: "تک‌مالت‌ها و بشکه‌های کمیاب" },
  { id: "wine", name: "شراب", slug: "wine", tagline: "سردابه‌های دنیای قدیم" },
  { id: "champagne", name: "شامپاین", slug: "champagne", tagline: "تولیدکننده و وینتیج" },
  { id: "gin", name: "جین", slug: "gin", tagline: "گیاهی و دسته‌کوچک" },
  { id: "rum", name: "رام", slug: "rum", tagline: "رسیده و تک‌املاک" },
  { id: "tequila", name: "تکیلا", slug: "tequila", tagline: "۱۰۰٪ آگاوه" },
  { id: "vodka", name: "ودکا", slug: "vodka", tagline: "تقطیر دست‌ساز" },
]

export async function getHomeCategories(): Promise<HomeCategory[]> {
  try {
    const res = await fetch(`${BASE}/categories${buildQuery({ limit: 12 })}`, {
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return FALLBACK_CATEGORIES

    const body = (await res.json()) as
      | { results?: ApiCategory[] }
      | ApiCategory[]
      | null
    const rows = Array.isArray(body) ? body : (body?.results ?? [])

    // Prefer top-level categories for the grid; fall back to the full list if
    // none are explicitly marked as roots.
    const roots = rows.filter((c) => c.parent_id == null)
    const source = roots.length > 0 ? roots : rows

    const mapped: HomeCategory[] = source.map((c) => {
      // Slug is nullable on the backend and isn't auto-generated, and a
      // Persian-only name latinises to "". Guarantee a non-empty, unique slug
      // (falling back to the row id) so links and React keys never collide.
      const explicit = c.slug?.trim()
      const slug = explicit && explicit !== "" ? explicit : toSlug(c.name) || `cat-${c.id}`
      return { id: c.id, name: c.name, slug, tagline: c.description ?? "" }
    })

    return mapped.length > 0 ? mapped : FALLBACK_CATEGORIES
  } catch {
    return FALLBACK_CATEGORIES
  }
}
