// features/admin/products/api.ts
import { apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  ProductFilter,
  ProductListItem,
  ProductDetail,
  CreateProductReq,
  UpdateProductReq,
  CreateVariantReq,
  ImageResponse,
  VariantResponse,
  OptionValueResponse,
} from "./types";

// ─────────────────────────────────────────────
// Product list (admin – includes inactive)
// ─────────────────────────────────────────────

export function fetchAdminProducts(
  filter: ProductFilter = {},
): Promise<{ items: ProductListItem[]; total: number }> {
  return apiFetch<{ items: ProductListItem[]; total: number }>(
    `/admin/products${buildQueryString(filter)}`,
  );
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export function createProduct(
  payload: CreateProductReq,
): Promise<ProductDetail> {
  return apiFetch<ProductDetail>("/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(
  id: number,
  payload: UpdateProductReq,
): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id: number): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────

export function syncProductTags(id: number, tagIds: number[]): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

export function attachProductTags(id: number, tagIds: number[]): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}/tags`, {
    method: "POST",
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

export function detachProductTags(id: number, tagIds: number[]): Promise<void> {
  return apiFetch<void>(`/admin/products/${id}/tags`, {
    method: "DELETE",
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

// ─────────────────────────────────────────────
// Variants (create, update, delete, attach options)
// ─────────────────────────────────────────────

/** Create a variant for a product. */
export function createVariant(
  productId: number,
  payload: CreateVariantReq,
): Promise<VariantResponse> {
  return apiFetch<VariantResponse>(`/admin/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update an existing variant by ID. */
export function updateVariant(
  variantId: number,
  payload: Partial<CreateVariantReq>,
): Promise<VariantResponse> {
  return apiFetch<VariantResponse>(`/admin/variants/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Delete a variant by ID. */
export function deleteVariant(variantId: number): Promise<void> {
  return apiFetch<void>(`/admin/variants/${variantId}`, {
    method: "DELETE",
  });
}

/** Attach option values to a variant (e.g., Color: Red, Size: 750ml). */
export function attachVariantOptions(
  variantId: number,
  options: Array<{ option_type: string; value: string }>,
): Promise<VariantResponse> {
  return apiFetch<VariantResponse>(`/admin/variants/${variantId}/options`, {
    method: "POST",
    body: JSON.stringify({ options }),
  });
}

// ─────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────

export function fetchAdminProductImages(
  productId: number,
): Promise<ImageResponse[]> {
  return apiFetch<ImageResponse[]>(`/admin/products/${productId}/images`);
}

export function uploadProductImage(
  productId: number,
  file: File,
  altText?: string,
  isPrimary = false,
): Promise<ImageResponse> {
  const formData = new FormData();
  formData.append("image", file);
  if (altText) formData.append("alt_text", altText);
  if (isPrimary) formData.append("is_primary", "true");

  return apiFetch<ImageResponse>(`/admin/products/${productId}/images`, {
    method: "POST",
    body: formData,
  });
}

export function reorderProductImages(
  productId: number,
  orders: Array<{ id: number; sort_order: number }>,
): Promise<void> {
  return apiFetch<void>(`/admin/products/${productId}/images/order`, {
    method: "PUT",
    body: JSON.stringify({ orders }),
  });
}

export function updateProductImage(
  productId: number,
  imageId: number,
  payload: Partial<Pick<ImageResponse, "alt_text" | "is_primary">>,
): Promise<ImageResponse> {
  return apiFetch<ImageResponse>(
    `/admin/products/${productId}/images/${imageId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function setPrimaryProductImage(
  productId: number,
  imageId: number,
): Promise<void> {
  return apiFetch<void>(
    `/admin/products/${productId}/images/${imageId}/primary`,
    {
      method: "PUT",
    },
  );
}

export function deleteProductImage(
  productId: number,
  imageId: number,
): Promise<void> {
  return apiFetch<void>(`/admin/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  });
}
