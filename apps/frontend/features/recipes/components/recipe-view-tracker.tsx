"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

import { useRecordInteraction } from "@/features/recommendations/hooks";

/**
 * On authenticated recipe detail mount, records recipe_view for each linked
 * product once. Failures are ignored so editorial pages never break.
 */
export function RecipeViewTracker({
  productIds,
  recipeId,
}: {
  productIds: number[];
  recipeId: number;
}) {
  const { status } = useSession();
  const record = useRecordInteraction();
  const fired = React.useRef(false);
  const productIdsKey = productIds.join(",");

  React.useEffect(() => {
    if (status !== "authenticated" || fired.current) return;
    const unique = [
      ...new Set(
        productIdsKey
          .split(",")
          .map((s) => Number(s))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    if (unique.length === 0) return;
    fired.current = true;
    for (const productId of unique) {
      void record
        .mutateAsync({
          product_id: productId,
          interaction_type: "recipe_view",
          source: "recipe_detail",
          metadata: { recipe_id: recipeId },
        })
        .catch(() => undefined);
    }
  }, [status, productIdsKey, recipeId, record]);

  return null;
}
