"use client";

import { useSession } from "next-auth/react";

import { ProductCard } from "@/features/catalog/products/components/product-card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { useRecordInteraction } from "@/features/recommendations/hooks";

/**
 * Product card on search hit results. For signed-in users, records a
 * search_click when the shopper activates a product link (capture phase so
 * nested links still count). Guests and failed recordings never block navigation.
 */
export function SearchResultProductCard({
  product,
  query,
}: {
  product: ProductListItem;
  query: string;
}) {
  const { status } = useSession();
  const record = useRecordInteraction();

  function trackClick() {
    if (status !== "authenticated" || product.id <= 0) return;
    void record
      .mutateAsync({
        product_id: product.id,
        interaction_type: "search_click",
        source: "search",
        metadata: { q: query.slice(0, 80) },
      })
      .catch(() => undefined);
  }

  return (
    <div
      onClickCapture={trackClick}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          trackClick();
        }
      }}
    >
      <ProductCard product={product} />
    </div>
  );
}
