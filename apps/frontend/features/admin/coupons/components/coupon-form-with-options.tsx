"use client";

import * as React from "react";

import { getCategoryTree } from "@/features/admin/categories/client";
import { listSelectableProducts } from "@/features/admin/products/api/client";
import type { Coupon } from "@/features/coupons/types";
import type { CategoryTree } from "@/features/catalog/categories/types";

import { CouponForm } from "./coupon-form";

function flattenCategories(
  nodes: CategoryTree[],
  acc: { id: number; title: string }[] = [],
  prefix = "",
): { id: number; title: string }[] {
  for (const node of nodes) {
    acc.push({
      id: node.id,
      title: prefix ? `${prefix} / ${node.title}` : node.title,
    });
    if (node.children?.length) {
      flattenCategories(node.children, acc, node.title);
    }
  }
  return acc;
}

/**
 * Loads catalogue options for product/category multi-selects, then renders
 * the coupon form (Task 084a).
 */
export function CouponFormWithOptions({
  mode,
  coupon,
}: {
  mode: "create" | "edit";
  coupon?: Coupon;
}) {
  const [productOptions, setProductOptions] = React.useState<
    { id: number; title: string }[]
  >([]);
  const [categoryOptions, setCategoryOptions] = React.useState<
    { id: number; title: string }[]
  >([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // CF-2: fetch exactly the products already in scope, by id, instead of
        // the newest 100 and hoping the selection is among them. The picker
        // searches the server from here on, so this is only about LABELLING an
        // existing selection — a scope pointing at product #500 used to render
        // as an empty picker over a discount that was really applied.
        const scopedIDs = coupon?.applicable_to?.product_ids ?? [];
        const [scoped, tree] = await Promise.all([
          scopedIDs.length
            ? listSelectableProducts({
                ids: scopedIDs.join(","),
                limit: Math.min(scopedIDs.length, 100),
                page: 1,
              })
            : Promise.resolve(null),
          getCategoryTree().catch(() => [] as CategoryTree[]),
        ]);
        if (cancelled) return;
        setProductOptions(
          (scoped?.results ?? []).map((p) => ({ id: p.id, title: p.title })),
        );
        setCategoryOptions(flattenCategories(tree));
      } catch {
        // The picker still works: it labels unknown ids as «محصول ۵۰۰» rather
        // than dropping them, so a failed lookup degrades instead of erasing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coupon]);

  return (
    <CouponForm
      mode={mode}
      coupon={coupon}
      productOptions={productOptions}
      categoryOptions={categoryOptions}
    />
  );
}
