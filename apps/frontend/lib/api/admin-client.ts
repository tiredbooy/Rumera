/**
 * Browser-side client for the admin BFF proxy (`/api/admin/*`). Mirrors
 * `store-client.ts` but targets staff-tier endpoints and adds a multipart
 * uploader with progress for the product image pipeline.
 *
 * `path` is the backend path after `/api/v1` (admin-namespaced calls include the
 * leading `admin/` segment — see `app/api/admin/[...path]/route.ts`).
 */
import type { ProductDetail } from "@/lib/catalog/types"

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
  return (body?.data ?? body) as T
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
