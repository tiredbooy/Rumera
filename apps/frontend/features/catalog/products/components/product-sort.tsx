"use client";

import type { ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

import {
  PRODUCT_LIST_SORT_OPTIONS,
  productListSortSelectValue,
} from "@/features/catalog/products/list-routing";
import {
  isProductSortDirection,
  isProductSortField,
} from "@/features/catalog/products/queries";

/**
 * Native sort control for /products. Rewrites only allowlisted `sortBy` /
 * `orderBy` pairs (price, title, created_at) and resets pagination.
 */
export function ProductSort() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const rawSortBy = params.get("sortBy") ?? "created_at";
  const rawOrderBy = params.get("orderBy") ?? "desc";
  const sortBy = isProductSortField(rawSortBy) ? rawSortBy : "created_at";
  const orderBy = isProductSortDirection(rawOrderBy) ? rawOrderBy : "desc";
  const current = productListSortSelectValue(sortBy, orderBy);

  const activeLabel =
    PRODUCT_LIST_SORT_OPTIONS.find(
      (option) =>
        productListSortSelectValue(option.sortBy, option.orderBy) === current,
    )?.label ?? "جدیدترین";

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const [nextSortBy, nextOrderBy] = event.target.value.split(":");
    if (
      !nextSortBy ||
      !nextOrderBy ||
      !isProductSortField(nextSortBy) ||
      !isProductSortDirection(nextOrderBy)
    ) {
      return;
    }

    const next = new URLSearchParams(params.toString());
    next.delete("sort"); // drop legacy unsupported keys
    if (nextSortBy === "created_at" && nextOrderBy === "desc") {
      next.delete("sortBy");
      next.delete("orderBy");
    } else {
      next.set("sortBy", nextSortBy);
      next.set("orderBy", nextOrderBy);
    }
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card/50 pe-3 ps-4 text-sm transition-colors hover:border-primary/40">
      <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">مرتب‌سازی:</span>
      <span className="font-medium">{activeLabel}</span>
      <select
        aria-label="مرتب‌سازی محصولات"
        value={
          PRODUCT_LIST_SORT_OPTIONS.some(
            (option) =>
              productListSortSelectValue(option.sortBy, option.orderBy) ===
              current,
          )
            ? current
            : "created_at:desc"
        }
        onChange={onChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {PRODUCT_LIST_SORT_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={productListSortSelectValue(option.sortBy, option.orderBy)}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
