/**
 * Storefront home "featured / newly arrived" fetcher (server-side, ISR-cached,
 * error-safe).
 *
 * Mirrors `lib/home/hero.ts` and `lib/home/categories.ts`: backed by the live
 * catalogue (`GET /products`, newest first) so the home grid reflects the real
 * shop, and falls back to a curated static set so the section never renders
 * empty when the backend is down or the catalogue is still being filled.
 *
 * Returns `ProductListItem[]` so the home grid renders with the same
 * `components/catalog/product-card` used by the products listing page — one card,
 * one data shape, no bespoke home-only product type.
 */
import { getFeatured } from "@/lib/catalog/products"
import type { ProductListItem } from "@/lib/catalog/types"
import { getFeatured as getCuratedProducts } from "@/lib/products"

/**
 * Curated fallback, adapted from the static showcase catalogue into the live
 * `ProductListItem` shape. Used only when the backend returns nothing so the
 * grid always looks stocked. Synchronous + module-level — the static set is
 * already in memory.
 */
export const FALLBACK_FEATURED: ProductListItem[] = getCuratedProducts()
  .slice(0, 8)
  .map((p, i) => ({
    id: i + 1,
    title: p.name,
    slug: p.slug,
    brand: p.maker,
    is_active: true,
    min_price: p.price,
    max_price: p.compareAt ?? p.price,
  }))

/**
 * Featured products for the home grid: the newest live products, or the curated
 * fallback when the catalogue is empty/unreachable. `getFeatured` is already
 * error-safe (returns `[]` on failure), so this only adds the never-empty guard.
 */
export async function getHomeFeatured(limit = 8): Promise<ProductListItem[]> {
  const items = await getFeatured(limit)
  return items.length > 0 ? items : FALLBACK_FEATURED
}
