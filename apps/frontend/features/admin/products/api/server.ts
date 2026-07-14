import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type {
  CreateProductInput,
  UpdateProductInput,
  CreateProductVariantInput,
  UpdateProductVariantInput,
  ReorderProductImagesInput,
  UpdateProductImageInput,
} from "../types";
import type { ProductListQuery } from "@/features/catalog/products/queries";
import type {
  ProductListItem,
  ProductDetail,
  ProductImage,
  ProductVariant,
} from "@/features/catalog/products/types";

// ─────────────────────────────────────────────
// Product list (admin – includes inactive)
// ─────────────────────────────────────────────

export function fetchAdminProducts(
  filter: ProductListQuery = {},
): Promise<Paginated<ProductListItem>> {
  return apiFetch<Paginated<ProductListItem>>(
    `/admin/products${buildQueryString(filter)}`,
  );
}

/** The backend exposes product detail through the public read route only. */
export function getProductForAdmin(id: number): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${id}`);
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export function createProduct(
  payload: CreateProductInput,
): Promise<ProductDetail> {
  return apiFetch<ProductDetail>("/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(
  id: number,
  payload: UpdateProductInput,
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
// Variants
// ─────────────────────────────────────────────

/** Create a variant for a product. */
export function createVariant(
  productId: number,
  payload: CreateProductVariantInput,
): Promise<ProductVariant> {
  return apiFetch<ProductVariant>(`/admin/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update an existing variant by ID. */
export function updateVariant(
  variantId: number,
  payload: UpdateProductVariantInput,
): Promise<ProductVariant> {
  return apiFetch<ProductVariant>(`/admin/variants/${variantId}`, {
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

// ─────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────

export function reorderProductImages(
  productId: number,
  imageIds: number[],
): Promise<void> {
  const payload: ReorderProductImagesInput = { ids: imageIds };
  return apiFetch<void>(`/admin/products/${productId}/images/order`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function updateProductImage(
  productId: number,
  imageId: number,
  payload: UpdateProductImageInput,
): Promise<ProductImage> {
  return apiFetch<ProductImage>(
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
