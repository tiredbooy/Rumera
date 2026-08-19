"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useRecordInteraction } from "@/features/recommendations/hooks";
import { useAddWishlistItem } from "@/features/wishlist/hooks";
import { stashSessionIntent, takeSessionIntent } from "@/lib/session-intent";

export const WISHLIST_INTENT_KEY = "rumera_wishlist_intent";

export type WishlistIntent = {
  product_variant_id: number;
  product_id?: number;
};

function parseWishlistIntent(raw: Record<string, unknown>): WishlistIntent | null {
  const variantId = Number(raw.product_variant_id);
  if (!Number.isFinite(variantId) || variantId < 1) return null;
  const productId = Number(raw.product_id);
  return {
    product_variant_id: Math.trunc(variantId),
    ...(Number.isFinite(productId) && productId > 0
      ? { product_id: Math.trunc(productId) }
      : {}),
  };
}

export function stashWishlistIntent(intent: WishlistIntent): void {
  stashSessionIntent(WISHLIST_INTENT_KEY, intent);
}

export function takeWishlistIntent(now = Date.now()): WishlistIntent | null {
  return takeSessionIntent(WISHLIST_INTENT_KEY, parseWishlistIntent, now);
}

export function PendingWishlistIntent() {
  const { status } = useSession();
  const { mutate } = useAddWishlistItem();
  const recordInteraction = useRecordInteraction();

  React.useEffect(() => {
    if (status !== "authenticated") return;
    const intent = takeWishlistIntent();
    if (!intent) return;

    mutate(intent.product_variant_id, {
      onSuccess: () => {
        toast.success("به علاقه‌مندی‌ها افزوده شد");
        if (intent.product_id) {
          recordInteraction.mutate({
            product_id: intent.product_id,
            interaction_type: "wishlist",
            source: "product_card",
          });
        }
      },
      onError: () => toast.error("افزودن به علاقه‌مندی‌ها ناموفق بود"),
    });
  }, [status, mutate, recordInteraction]);

  return null;
}
