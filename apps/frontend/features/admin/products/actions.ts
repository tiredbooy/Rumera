"use server";

import type {
  CreateProductReq,
  UpdateProductReq,
  CreateVariantReq,
  ProductDetail,
  VariantResponse,
} from "@/features/admin/products/types";

// Import the actual implementations from the API layer
import {
  createProduct as _createProduct,
  updateProduct as _updateProduct,
  deleteProduct as _deleteProduct,
  createVariant as _createVariant,
  updateVariant as _updateVariant,
  deleteVariant as _deleteVariant,
} from "@/features/admin/products/api";

// Wrap each as an explicit async function
export async function createProduct(
  payload: CreateProductReq,
): Promise<ProductDetail> {
  return _createProduct(payload);
}

export async function updateProduct(
  id: number,
  payload: UpdateProductReq,
): Promise<ProductDetail> {
  return _updateProduct(id, payload);
}

export async function deleteProduct(id: number): Promise<void> {
  return _deleteProduct(id);
}

export async function createVariant(
  productId: number,
  payload: CreateVariantReq,
): Promise<VariantResponse> {
  return _createVariant(productId, payload);
}

export async function updateVariant(
  variantId: number,
  payload: Partial<CreateVariantReq>,
): Promise<VariantResponse> {
  return _updateVariant(variantId, payload);
}

export async function deleteVariant(variantId: number): Promise<void> {
  return _deleteVariant(variantId);
}
