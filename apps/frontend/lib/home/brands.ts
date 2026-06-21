/**
 * Trust-marquee brands for the home page (server-side, ISR-cached, error-safe).
 *
 * Backed by the Go `GET /brands` endpoint so the marquee reflects the real
 * brands in the catalogue — add a brand in the admin dashboard and it shows up
 * here, no code change needed. Falls back to a curated static set so the marquee
 * always renders something premium when the backend is down or no brands exist
 * yet. Mirrors `lib/home/categories.ts`.
 *
 * Rumera is a broad premium marketplace — not a single-category shop — so the
 * fallback pairs globally recognised houses across spirits and lifestyle.
 * (Logo images can replace the wordmarks later — see public/images/README.md.)
 */
import { buildQuery } from "@/lib/api/qs"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 3600

/** Raw shape returned by `GET /brands` (mirrors the backend Brand model). */
type ApiBrand = { id: number; title: string }

/** Curated fallback; used only when the backend returns nothing or is unreachable. */
export const FALLBACK_BRANDS: string[] = [
  "Johnnie Walker",
  "Jack Daniel's",
  "Absolut",
  "Hennessy",
  "Moët & Chandon",
  "Grey Goose",
  "Chivas Regal",
  "Glenfiddich",
  "Bombay Sapphire",
  "Bacardí",
  "Jameson",
  "The Macallan",
  "Belvedere",
  "Martini",
  "Campari",
  "Tanqueray",
]

/** Brand wordmarks for the home marquee — live brands, or the curated fallback. */
export async function getFeaturedBrands(limit = 16): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/brands${buildQuery({ limit })}`, {
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return FALLBACK_BRANDS

    const body = (await res.json()) as
      | { results?: ApiBrand[] }
      | ApiBrand[]
      | null
    const rows = Array.isArray(body) ? body : (body?.results ?? [])

    const names = rows
      .map((b) => b.title?.trim())
      .filter((t): t is string => !!t)

    return names.length > 0 ? names : FALLBACK_BRANDS
  } catch {
    return FALLBACK_BRANDS
  }
}
