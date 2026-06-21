/**
 * Browser-side client for the admin BFF proxy (`/api/admin/*`). Mirrors
 * `store-client.ts` but targets staff-tier endpoints and adds a multipart
 * uploader with progress for the product image pipeline.
 *
 * `path` is the backend path after `/api/v1` (admin-namespaced calls include the
 * leading `admin/` segment — see `app/api/admin/[...path]/route.ts`).
 */
import type {
  Brand,
  Category,
  OrderListItem,
  OrderStatus,
  Paginated,
  ProductDetail,
} from "@/lib/catalog/types"
import type { RecipeDetail, RecipeDifficulty, RecipeListItem } from "@/lib/recipes"
import type { Role } from "@/lib/rbac/roles"
import { buildQuery } from "@/lib/api/qs"

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>
  ) {
    super(message)
    this.name = "AdminApiError"
  }
}

async function parseError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null)
  throw new AdminApiError(
    res.status,
    body?.error?.code ?? "UNKNOWN",
    body?.error?.message ?? res.statusText,
    body?.error?.fields
  )
}

/** JSON request → unwraps the `{ data }` envelope (or returns undefined on 204). */
export async function adminRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
  })

  if (res.status === 204) return undefined as T

  if (!res.ok) return parseError(res)

  const body = await res.json().catch(() => null)
  return (body && "data" in body ? body.data : body) as T
}

// ── Image contract (frozen — see docs/superpowers/specs/…-admin-images…) ──────

/** An uploaded product image as returned by the admin image endpoints. */
export type AdminProductImage = {
  id: number
  /** Storage key, e.g. `products/9f8c….webp`. */
  key: string
  /** Public transform base, e.g. `/media/products/9f8c….webp`. */
  url: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
  width: number
  height: number
}

// ── Product input shapes (mirror CreateProductReq / UpdateProductReq) ─────────

export type CreateVariantInput = {
  sku?: string | null
  price: number
  compare_at_price?: number | null
  option_value_ids?: number[]
}

export type CreateProductInput = {
  title: string
  code?: string | null
  slug?: string | null
  category_id?: number | null
  description?: string | null
  brand_id?: number | null
  country_of_origin?: string | null
  abv?: number | null
  weight?: number | null
  meta_title?: string | null
  meta_description?: string | null
  meta_tags?: string[]
  tag_ids?: number[]
  variants?: CreateVariantInput[]
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, "variants">> & {
  is_active?: boolean
}

export type UpdateVariantInput = {
  sku?: string | null
  price?: number
  compare_at_price?: number | null
  is_active?: boolean
}

// ── Product mutations ─────────────────────────────────────────────────────────

export function createProduct(input: CreateProductInput) {
  return adminRequest<ProductDetail>("admin/products", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateProduct(id: number, input: UpdateProductInput) {
  return adminRequest<ProductDetail>(`admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

// ── Variant mutations ─────────────────────────────────────────────────────────

export function createVariant(productId: number, input: CreateVariantInput) {
  return adminRequest<{ id: number }>(`admin/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateVariant(variantId: number, input: UpdateVariantInput) {
  return adminRequest<{ id: number }>(`admin/variants/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteVariant(variantId: number) {
  return adminRequest<void>(`admin/variants/${variantId}`, { method: "DELETE" })
}

// ── Image operations ──────────────────────────────────────────────────────────

export function listProductImages(productId: number) {
  return adminRequest<AdminProductImage[]>(`admin/products/${productId}/images`)
}

/**
 * Multipart upload via XHR so the caller can render real upload progress (the
 * browser→Next leg is the meaningful one). Resolves with the created image row.
 */
export function uploadProductImage(
  productId: number,
  file: File,
  opts: { altText?: string; isPrimary?: boolean; signal?: AbortSignal } = {},
  onProgress?: (fraction: number) => void
): Promise<AdminProductImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", file)
    if (opts.altText) form.append("alt_text", opts.altText)
    if (opts.isPrimary) form.append("is_primary", "true")

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/admin/admin/products/${productId}/images`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }

    xhr.onload = () => {
      let body: { data?: AdminProductImage; error?: { code?: string; message?: string } } | null =
        null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) {
        resolve(body.data)
      } else {
        reject(
          new AdminApiError(
            xhr.status,
            body?.error?.code ?? "UPLOAD_FAILED",
            body?.error?.message ?? "بارگذاری تصویر ناموفق بود"
          )
        )
      }
    }
    xhr.onerror = () =>
      reject(new AdminApiError(0, "NETWORK", "ارتباط با سرور برقرار نشد"))
    xhr.onabort = () => reject(new AdminApiError(0, "ABORTED", "بارگذاری لغو شد"))

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort()
        return
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true })
    }

    xhr.send(form)
  })
}

/** A standalone uploaded image (hero/recipe/journal cover) → just a public URL. */
export type UploadedImage = {
  url: string
  key: string
  width: number
  height: number
}

/**
 * Multipart upload for standalone images that are stored as a plain URL on their
 * owning entity (hero slides, recipes, journals) — as opposed to the product
 * image pipeline which keeps DB rows. XHR-based so callers can show progress.
 * Hits `POST /admin/uploads`; `folder` selects the storage bucket.
 */
export function uploadImage(
  file: File,
  opts: { folder?: string; signal?: AbortSignal } = {},
  onProgress?: (fraction: number) => void
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", file)
    if (opts.folder) form.append("folder", opts.folder)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/admin/admin/uploads`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }

    xhr.onload = () => {
      let body: { data?: UploadedImage; error?: { code?: string; message?: string } } | null = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) {
        resolve(body.data)
      } else {
        reject(
          new AdminApiError(
            xhr.status,
            body?.error?.code ?? "UPLOAD_FAILED",
            body?.error?.message ?? "بارگذاری تصویر ناموفق بود"
          )
        )
      }
    }
    xhr.onerror = () => reject(new AdminApiError(0, "NETWORK", "ارتباط با سرور برقرار نشد"))
    xhr.onabort = () => reject(new AdminApiError(0, "ABORTED", "بارگذاری لغو شد"))

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort()
        return
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true })
    }

    xhr.send(form)
  })
}

export function reorderProductImages(productId: number, ids: number[]) {
  return adminRequest<void>(`admin/products/${productId}/images/order`, {
    method: "PUT",
    body: JSON.stringify({ ids }),
  })
}

export function setPrimaryImage(productId: number, imageId: number) {
  return adminRequest<void>(`admin/products/${productId}/images/${imageId}/primary`, {
    method: "PUT",
  })
}

export function updateImageAlt(productId: number, imageId: number, altText: string) {
  return adminRequest<AdminProductImage>(`admin/products/${productId}/images/${imageId}`, {
    method: "PATCH",
    body: JSON.stringify({ alt_text: altText }),
  })
}

export function deleteProductImage(productId: number, imageId: number) {
  return adminRequest<void>(`admin/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  })
}

// ── Category input shapes (mirror CreateCategoryReq / UpdateCategoryReq) ───────

export type CreateCategoryInput = {
  name: string
  parent_id?: number | null
  slug?: string | null
  description?: string | null
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>

/** Hierarchical category node as returned by GET /categories/tree. */
export type CategoryTreeNode = {
  id: number
  name: string
  description?: string | null
  slug?: string | null
  children?: CategoryTreeNode[]
}

// ── Category operations ───────────────────────────────────────────────────────

/** Flat list for the parent picker / list view (public read; no admin scope). */
export function listCategories() {
  return adminRequest<Paginated<Category>>("categories?limit=100")
}

/** Nested tree for the parent picker. Served under `{ data }`. */
export async function getCategoryTree() {
  const tree = await adminRequest<CategoryTreeNode[] | null>("categories/tree")
  return tree ?? []
}

export function createCategory(input: CreateCategoryInput) {
  return adminRequest<Category>("admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateCategory(id: number, input: UpdateCategoryInput) {
  return adminRequest<Category>(`admin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteCategory(id: number) {
  return adminRequest<void>(`admin/categories/${id}`, { method: "DELETE" })
}

// ── Brand input shapes (mirror CreateBrandReq / UpdateBrandReq) ───────────────

export type CreateBrandInput = {
  title: string
  country?: string | null
  founded_year?: number | null
  image_url?: string | null
  description?: string | null
}

export type UpdateBrandInput = Partial<CreateBrandInput>

// ── Brand operations ──────────────────────────────────────────────────────────

/** Flat list for the brand picker / list view (public read; no admin scope). */
export function listBrands() {
  return adminRequest<Paginated<Brand>>("brands?limit=100")
}

export function createBrand(input: CreateBrandInput) {
  return adminRequest<Brand>("admin/brands", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateBrand(id: number, input: UpdateBrandInput) {
  return adminRequest<Brand>(`admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteBrand(id: number) {
  return adminRequest<void>(`admin/brands/${id}`, { method: "DELETE" })
}

// ── Recipe input shapes (mirror RecipeReq / RecipeUpdateReq) ──────────────────

export type RecipeStatus = "draft" | "published" | "archived"

/** One ingredient line; `product_variant_id` links it to the catalogue. */
export type RecipeIngredientInput = {
  product_variant_id?: number | null
  ingredient_name: string
  quantity?: string | null
  unit?: string | null
  optional?: boolean
  notes?: string | null
  sort_order?: number | null
}

/** A shoppable product line (must reference a concrete variant). */
export type RecipeProductInput = {
  product_variant_id: number
  quantity?: string | null
  unit?: string | null
  sort_order?: number | null
  is_primary?: boolean
  role?: string | null
}

export type CreateRecipeInput = {
  title: string
  slug?: string | null
  excerpt?: string | null
  description?: string | null
  content: string
  difficulty?: RecipeDifficulty
  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number
  calories?: number | null
  cocktail_type?: string | null
  glass_type?: string | null
  serving_suggestion?: string | null
  image_url?: string | null
  status?: RecipeStatus
  is_featured?: boolean
  published_at?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string[]
  canonical_url?: string | null
  og_image_url?: string | null
  ingredients?: RecipeIngredientInput[]
  products?: RecipeProductInput[]
  tag_ids?: number[]
}

export type UpdateRecipeInput = Partial<CreateRecipeInput>

export type ListRecipesParams = {
  page?: number
  limit?: number
  search?: string
  status?: RecipeStatus
  difficulty?: RecipeDifficulty
  is_featured?: boolean
  tag_id?: number
  sortBy?: string
  orderBy?: "asc" | "desc"
}

// ── Recipe operations ─────────────────────────────────────────────────────────

/** Admin listing — all statuses (drafts included). */
export function listAdminRecipes(params: ListRecipesParams = {}) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value))
  }
  const query = qs.toString()
  return adminRequest<Paginated<RecipeListItem>>(`admin/recipes${query ? `?${query}` : ""}`)
}

/** Single recipe (hydrated with ingredients/products/tags) for the editor. */
export function getAdminRecipe(id: number) {
  return adminRequest<RecipeDetail>(`admin/recipes/${id}`)
}

export function createRecipe(input: CreateRecipeInput) {
  return adminRequest<RecipeDetail>("admin/recipes", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateRecipe(id: number, input: UpdateRecipeInput) {
  return adminRequest<RecipeDetail>(`admin/recipes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteRecipe(id: number) {
  return adminRequest<void>(`admin/recipes/${id}`, { method: "DELETE" })
}

// ── User / account shapes (mirror UserAdminResponse / UpdateUserReq) ──────────

/** A user's gender as stored by the backend. */
export type UserGender = "male" | "female" | "other"

/**
 * Full admin view of a user — returned by `GET /admin/users/:id` and the
 * `PATCH` response. Optional profile fields may be absent (never-set) or null.
 */
export type UserAdminResponse = {
  user_id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  national_code?: string | null
  birth_date?: string | null
  gender?: UserGender | null
  role: Role
  is_active: boolean
  created_at: string
}

/** Row shape for the admin user list (`GET /admin/users`). */
export type UserListItem = {
  user_id: string
  first_name?: string | null
  last_name?: string | null
  email: string
  role: Role
  is_active: boolean
  created_at: string
}

/**
 * Partial patch for `PATCH /admin/users/:id`. Every field is optional; only the
 * keys present are updated. `role` and `is_active` are admin-only and guarded
 * server-side (an admin cannot demote/deactivate their own account → 403).
 */
export type UpdateUserInput = {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  national_code?: string | null
  /** RFC3339 timestamp, or null to clear. */
  birth_date?: string | null
  gender?: UserGender | null
  role?: Role
  is_active?: boolean
}

// ── User operations ───────────────────────────────────────────────────────────

/** Single user (full admin view) for the edit screen. */
export function getAdminUser(id: string) {
  return adminRequest<UserAdminResponse>(`admin/users/${id}`)
}

export function adminUpdateUser(id: string, input: UpdateUserInput) {
  return adminRequest<UserAdminResponse>(`admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

/** Query params for the admin user list (`GET /admin/users`, paginated). */
export type ListUsersParams = {
  page?: number
  limit?: number
  search?: string
  role?: Role
  is_active?: boolean
}

/** Paginated admin user list for the customers table. */
export function listUsers(params: ListUsersParams = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.limit) qs.set("limit", String(params.limit))
  if (params.search) qs.set("search", params.search)
  if (params.role) qs.set("role", params.role)
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active))
  const query = qs.toString()
  return adminRequest<Paginated<UserListItem>>(`admin/users${query ? `?${query}` : ""}`)
}

// ── Site settings (mirror the site_settings JSONB document) ───────────────────

export type SiteSettings = {
  store: { name: string; tagline: string; logoUrl: string; description: string }
  contact: { supportEmail: string; supportPhone: string; address: string; workingHours: string }
  social: {
    instagram: string
    telegram: string
    whatsapp: string
    twitter: string
    youtube: string
    linkedin: string
  }
  shipping: { freeThreshold: number; note: string }
  seo: { defaultTitle: string; defaultDescription: string; ogImage: string; keywords: string }
  maintenance: { enabled: boolean; message: string }
  /** RFC3339; present on the admin GET/PUT response, not sent on update. */
  updatedAt?: string
}

/**
 * Partial update for `PUT /admin/settings`. Omit a group to leave it unchanged;
 * include a group to replace it WHOLESALE (send every field in that group).
 */
export type UpdateSiteSettingsInput = Partial<Omit<SiteSettings, "updatedAt">>

/** Full settings document (admin view, includes updatedAt). */
export function getSiteSettings() {
  return adminRequest<SiteSettings>("admin/settings")
}

export function updateSiteSettings(input: UpdateSiteSettingsInput) {
  return adminRequest<SiteSettings>("admin/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

// ── Hero slide shapes (mirror HeroSlideReq / HeroSlideUpdateReq) ──────────────

export type HeroSlideTheme = "light" | "dark"

export type HeroSlide = {
  id: number
  eyebrow: string | null
  title: string
  subtitle: string | null
  badge: string | null
  image_url: string
  mobile_image_url: string | null
  image_alt: string | null
  cta_label: string | null
  cta_href: string | null
  secondary_cta_label: string | null
  secondary_cta_href: string | null
  theme: HeroSlideTheme
  sort_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
}

export type CreateHeroSlideInput = {
  eyebrow?: string | null
  title: string
  subtitle?: string | null
  badge?: string | null
  image_url: string
  mobile_image_url?: string | null
  image_alt?: string | null
  cta_label?: string | null
  cta_href?: string | null
  secondary_cta_label?: string | null
  secondary_cta_href?: string | null
  theme?: HeroSlideTheme
  sort_order?: number
  is_active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export type UpdateHeroSlideInput = Partial<CreateHeroSlideInput>

// ── Hero slide operations ─────────────────────────────────────────────────────

/** Admin listing — all slides (inactive/scheduled included). */
export function listHeroSlides() {
  return adminRequest<HeroSlide[]>("admin/hero-slides")
}

export function createHeroSlide(input: CreateHeroSlideInput) {
  return adminRequest<HeroSlide>("admin/hero-slides", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateHeroSlide(id: number, input: UpdateHeroSlideInput) {
  return adminRequest<HeroSlide>(`admin/hero-slides/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteHeroSlide(id: number) {
  return adminRequest<void>(`admin/hero-slides/${id}`, { method: "DELETE" })
}

// ── Analytics ────────────────────────────────────────────────────────────────
// NOTE: money/rate fields use shopspring/decimal on the backend, which marshals
// to JSON *strings* (e.g. "12345.67"). Parse with Number() before charting.

/** RFC3339 `from`/`to` window accepted by every analytics endpoint. */
export type AnalyticsRange = { from?: string; to?: string }

/** GET /admin/analytics/revenue/summary — aggregate KPIs over a date range. */
export type RevenueSummary = {
  total_orders: number
  total_gross_revenue: string
  total_net_revenue: string
  total_refunds: string
  total_discounts: string
  avg_order_value: string
  avg_conversion_rate: string
  unique_customers: number
}

/** One daily row of GET /admin/analytics/revenue/timeseries. */
export type DailyRevenueStat = {
  date: string
  orders_total: number
  orders_completed: number
  orders_cancelled: number
  orders_refunded: number
  net_revenue: string
  gross_revenue: string
  avg_order_value: string
  orders_new_customers: number
  orders_returning: number
  unique_customers: number
  conversion_rate: string
}

export function getRevenueSummary(range: AnalyticsRange = {}): Promise<RevenueSummary> {
  return adminRequest<RevenueSummary>(`admin/analytics/revenue/summary${buildQuery(range)}`)
}

export function getRevenueTimeSeries(range: AnalyticsRange = {}): Promise<DailyRevenueStat[]> {
  return adminRequest<DailyRevenueStat[]>(`admin/analytics/revenue/timeseries${buildQuery(range)}`)
}

/** GET /admin/analytics/revenue/today — a single daily stats row for today. */
export function getRevenueToday(): Promise<DailyRevenueStat> {
  return adminRequest<DailyRevenueStat>("admin/analytics/revenue/today")
}

// ── Orders ───────────────────────────────────────────────────────────────────
// Reuses the storefront Order/OrderListItem/OrderStatus types — the admin
// endpoints return the same shapes. NOTE: the list/detail responses do NOT carry
// customer identity or shipping address (no join server-side), and item_count is
// not yet computed — the admin UI degrades around those gaps.

export type ListOrdersParams = {
  page?: number
  limit?: number
  status?: OrderStatus
  user_id?: number
  search?: string
  sortBy?: string
  orderBy?: "asc" | "desc"
}

/** GET /admin/orders — paginated order list. */
export function listOrders(params: ListOrdersParams = {}): Promise<Paginated<OrderListItem>> {
  return adminRequest<Paginated<OrderListItem>>(`admin/orders${buildQuery(params)}`)
}

/** PATCH /admin/orders/:id/status — move an order to a new status. */
export function updateOrderStatus(id: number, status: OrderStatus): Promise<OrderListItem> {
  return adminRequest<OrderListItem>(`admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

// ── Inventory ────────────────────────────────────────────────────────────────

/** A low-stock row from GET /admin/inventory/low-stock (keyed by variant id). */
export type AdminInventoryRow = {
  id: number
  product_variant_id: number
  stock_on_hand: number
  committed_stock: number
  available_stock: number
  reorder_point: number
  reorder_quantity: number
  last_restock_at?: string | null
  updated_at: string
}

/** GET /admin/inventory/low-stock — variants at/below their reorder point. */
export function getLowStockInventory(): Promise<AdminInventoryRow[]> {
  return adminRequest<AdminInventoryRow[]>("admin/inventory/low-stock")
}
