"use server";

import { revalidatePath } from "next/cache";
import {
  deleteProductImage as deleteImageOnServer,
  reorderProductImages as reorderImagesOnServer,
  setPrimaryProductImage,
  updateProductImage,
} from "@/features/admin/products/api/server";

export async function reorderProductImages(
  productId: number,
  imageIds: number[],
) {
  await reorderImagesOnServer(productId, imageIds);
  revalidatePath(`/admin/products/${productId}`);
}

export async function setPrimaryImage(productId: number, imageId: number) {
  await setPrimaryProductImage(productId, imageId);
  revalidatePath(`/admin/products/${productId}`);
}

export async function updateImageAlt(
  productId: number,
  imageId: number,
  altText: string,
) {
  const image = await updateProductImage(productId, imageId, {
    alt_text: altText,
  });
  revalidatePath(`/admin/products/${productId}`);
  return image;
}

export async function deleteProductImage(productId: number, imageId: number) {
  await deleteImageOnServer(productId, imageId);
  revalidatePath(`/admin/products/${productId}`);
}
