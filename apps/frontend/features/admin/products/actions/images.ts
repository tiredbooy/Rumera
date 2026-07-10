"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api/client";
import type { ProductImage } from "@/lib/catalog/types";

export async function listProductImages(
  productId: number,
): Promise<ProductImage[]> {
  return apiFetch<ProductImage[]>(`/admin/products/${productId}/images`);
}

export async function reorderProductImages(
  productId: number,
  imageIds: number[],
) {
  await apiFetch(`/admin/products/${productId}/images/order`, {
    method: "PUT",
    body: JSON.stringify({ image_ids: imageIds }),
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function setPrimaryImage(productId: number, imageId: number) {
  await apiFetch(`/admin/products/${productId}/images/${imageId}/primary`, {
    method: "PUT",
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function updateImageAlt(
  productId: number,
  imageId: number,
  altText: string,
) {
  await apiFetch(`/admin/products/${productId}/images/${imageId}`, {
    method: "PATCH",
    body: JSON.stringify({ alt_text: altText }),
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteProductImage(productId: number, imageId: number) {
  await apiFetch(`/admin/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  });
  revalidatePath(`/admin/products/${productId}`);
}
