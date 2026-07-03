/**
 * Storefront home category fetcher (server-side, ISR-cached, error-safe).
 *
 * Mirrors `lib/home/hero.ts`: backed by the Go `GET /categories/featured` endpoint
 * (public), error-safe so `next build` and rendering never hard-fail,
 * and ISR-cached. Falls back to a curated static set so the home grid always
 * renders something premium even with the backend down or no categories yet.
 *
 * This makes the home "shop by category" section fully data-driven — add a
 * category in the admin dashboard and it shows up here, no code change needed.
 */

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

/** A category as the home grid needs it (display-ready). */
export interface Category {
  id: number
  title: string
  description?: string
  image_url?: string
  slug: string
  is_featured?: boolean
  card_size?: "small" | "large"
  display_order?: number
}

/** Raw shape returned by `GET /categories/featured` (mirrors the backend CategoryResponse). */
type ApiCategory = {
  id: number
  title: string
  slug?: string | null
  description?: string | null
  parent_id?: number | null
  image_url?: string | null
  is_featured?: boolean
  card_size?: "small" | "large"
  display_order?: number
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
export const FALLBACK_CATEGORIES: Category[] = [
  { id: -1, title: "ویسکی", slug: "whisky", description: "تک‌مالت‌ها و بشکه‌های کمیاب" },
  { id: -2, title: "شراب", slug: "wine", description: "سردابه‌های دنیای قدیم" },
  { id: -3, title: "شامپاین", slug: "champagne", description: "تولیدکننده و وینتیج" },
  { id: -4, title: "جین", slug: "gin", description: "گیاهی و دسته‌کوچک" },
  { id: -5, title: "رام", slug: "rum", description: "رسیده و تک‌املاک" },
  { id: -6, title: "تکیلا", slug: "tequila", description: "۱۰۰٪ آگاوه" },
  { id: -7, title: "ودکا", slug: "vodka", description: "تقطیر دست‌ساز" },
]

export async function getHomeCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${BASE}/categories/featured`, {
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

    const mapped: Category[] = source.map((c) => {
      // Slug is nullable on the backend and isn't auto-generated, and a
      // Persian-only title latinises to "". Guarantee a non-empty, unique slug
      // (falling back to the row id) so links and React keys never collide.
      const explicit = c.slug?.trim()
      const slug = explicit && explicit !== "" ? explicit : toSlug(c.title) || `cat-${c.id}`
      return {
        id: c.id,
        title: c.title,
        slug,
        description: c.description ?? "",
        image_url: c.image_url ?? undefined,
        is_featured: c.is_featured,
        card_size: c.card_size,
        display_order: c.display_order,
      }
    })

    return mapped.length > 0 ? mapped : FALLBACK_CATEGORIES
  } catch {
    return FALLBACK_CATEGORIES
  }
}