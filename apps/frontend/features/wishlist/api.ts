"use client";

import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess } from "@/lib/api/types";

import type {
  AddWishlistItemInput,
  AddWishlistItemResult,
  Wishlist,
  WishlistMembership,
} from "./types";

export function getWishlist(): Promise<Wishlist> {
  return storeRequest<ApiSuccess<Wishlist>>("wishlist").then(
    (body) => ({ ...body.data, items: body.data.items ?? [] }),
  );
}

export function addWishlistItem(
  productVariantId: number,
): Promise<AddWishlistItemResult> {
  return storeRequest<ApiSuccess<AddWishlistItemResult>>("wishlist/items", {
    method: "POST",
    body: JSON.stringify({
      product_variant_id: productVariantId,
    } satisfies AddWishlistItemInput),
  }).then((body) => body.data);
}

export function removeWishlistItem(itemId: number): Promise<void> {
  return storeRequest<void>(`wishlist/items/${itemId}`, { method: "DELETE" });
}

export function clearWishlist(): Promise<void> {
  return storeRequest<void>("wishlist", { method: "DELETE" });
}

export function hasWishlistItem(variantId: number): Promise<boolean> {
  return storeRequest<ApiSuccess<WishlistMembership>>(
    `wishlist/has/${variantId}`,
  ).then((body) => body.data.has_item);
}
