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
        const [productsPage, tree] = await Promise.all([
          listSelectableProducts({ limit: 100, page: 1 }),
          getCategoryTree().catch(() => [] as CategoryTree[]),
        ]);
        if (cancelled) return;
        setProductOptions(
          (productsPage.results ?? []).map((p) => ({
            id: p.id,
            title: p.title,
          })),
        );
        setCategoryOptions(flattenCategories(tree));
      } catch {
        // Form still works; pickers show empty labels.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CouponForm
      mode={mode}
      coupon={coupon}
      productOptions={productOptions}
      categoryOptions={categoryOptions}
    />
  );
}
