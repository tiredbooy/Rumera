"use server";

import { revalidatePath } from "next/cache";

import type {
  CreateProductInput,
  UpdateProductInput,
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from "@/features/admin/products/types";
import type {
  ProductDetail,
  ProductVariant,
} from "@/features/catalog/products/types";
import { ApiError } from "@/lib/api/errors";
import { revalidateAfterAdminMutation } from "@/lib/apply-admin-revalidation";

// Import the actual implementations from the API layer
import {
  createProduct as _createProduct,
  updateProduct as _updateProduct,
  deleteProduct as _deleteProduct,
  createVariant as _createVariant,
  updateVariant as _updateVariant,
  deleteVariant as _deleteVariant,
  replaceVariantOptions as _replaceVariantOptions,
} from "@/features/admin/products/api/server";

export type DeleteProductResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

/** Server actions hit the API directly; mirror BFF storefront invalidation. */
function revalidateProductSurfaces(id: number, method = "PATCH") {
  revalidateAfterAdminMutation(
    ["admin", "products", String(id)],
    method,
    method === "DELETE" ? 204 : 200,
  );
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
}

// Wrap each as an explicit async function
export async function createProduct(
  payload: CreateProductInput,
): Promise<ProductDetail> {
  const product = await _createProduct(payload);
  revalidateProductSurfaces(product.id, "POST");
  return product;
}

export async function updateProduct(
  id: number,
  payload: UpdateProductInput,
): Promise<ProductDetail> {
  const product = await _updateProduct(id, payload);
  revalidateProductSurfaces(id);
  return product;
}

export async function deleteProduct(id: number): Promise<DeleteProductResult> {
  try {
    await _deleteProduct(id);
    revalidateProductSurfaces(id, "DELETE");
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404 || error.code === "NOT_FOUND") {
        return {
          ok: false,
          code: error.code,
          message: "محصول یافت نشد یا قبلاً حذف شده است.",
        };
      }
      if (error.status === 403) {
        return {
          ok: false,
          code: error.code,
          message: "اجازهٔ حذف این محصول را ندارید.",
        };
      }
      return {
        ok: false,
        code: error.code,
        message: error.message || "حذف محصول ناموفق بود.",
      };
    }
    return { ok: false, message: "حذف محصول ناموفق بود. دوباره تلاش کنید." };
  }
}

export async function createVariant(
  productId: number,
  payload: CreateProductVariantInput,
): Promise<ProductVariant> {
  return _createVariant(productId, payload);
}

export async function updateVariant(
  variantId: number,
  payload: UpdateProductVariantInput,
): Promise<ProductVariant> {
  return _updateVariant(variantId, payload);
}

export async function deleteVariant(variantId: number): Promise<void> {
  return _deleteVariant(variantId);
}

export async function replaceVariantOptions(
  variantId: number,
  optionValueIds: number[],
): Promise<void> {
  return _replaceVariantOptions(variantId, optionValueIds);
}
