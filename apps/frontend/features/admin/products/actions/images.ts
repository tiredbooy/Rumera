"use server";

import { revalidatePath } from "next/cache";
import {
  deleteProductImage as deleteImageOnServer,
  reorderProductImages as reorderImagesOnServer,
  setPrimaryProductImage,
  updateProductImage,
} from "@/features/admin/products/api/server";
import { revalidateAfterAdminMutation } from "@/lib/apply-admin-revalidation";

/** Image mutations use server actions (not the BFF); invalidate storefront too. */
function revalidateProductMedia(productId: number) {
  revalidateAfterAdminMutation(
    ["admin", "products", String(productId), "images"],
    "POST",
    200,
  );
  revalidatePath(`/admin/products/${productId}`);
}

export async function reorderProductImages(
  productId: number,
  imageIds: number[],
) {
  await reorderImagesOnServer(productId, imageIds);
  revalidateProductMedia(productId);
}

export async function setPrimaryImage(productId: number, imageId: number) {
  await setPrimaryProductImage(productId, imageId);
  revalidateProductMedia(productId);
}

export async function updateImageAlt(
  productId: number,
  imageId: number,
  altText: string,
) {
  const image = await updateProductImage(productId, imageId, {
    alt_text: altText,
  });
  revalidateProductMedia(productId);
  return image;
}

export async function deleteProductImage(productId: number, imageId: number) {
  await deleteImageOnServer(productId, imageId);
  revalidateProductMedia(productId);
}
