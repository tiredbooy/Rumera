"use server";

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

// Wrap each as an explicit async function
export async function createProduct(
  payload: CreateProductInput,
): Promise<ProductDetail> {
  return _createProduct(payload);
}

export async function updateProduct(
  id: number,
  payload: UpdateProductInput,
): Promise<ProductDetail> {
  return _updateProduct(id, payload);
}

export async function deleteProduct(id: number): Promise<void> {
  return _deleteProduct(id);
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
