"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ShoppingBag } from "lucide-react";

import { AddAllIngredientsButton } from "@/features/recipes/components/add-all-button";
import type { ShoppableProduct } from "@/features/recipes/types";
import { faNum } from "@/lib/products";

/**
 * Sticky mobile bar: jump to shop + bulk-add so buying ingredients is always
 * one thumb-reach away while reading the recipe.
 */
export function RecipeMobileShopBar({
  products,
  shopId,
}: {
  products: ShoppableProduct[];
  shopId: string;
}) {
  const available = products.filter((p) => p.is_available).length;
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (products.length === 0 || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]"
      aria-label="خرید مواد دستور"
      data-recipe-mobile-shop-bar
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {available > 0
              ? `${faNum(available)} ماده آماده خرید`
              : "محصولات این دستور"}
          </p>
          <a
            href={`#${shopId}`}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary outline-none focus-visible:underline"
          >
            <ShoppingBag className="size-3.5" aria-hidden />
            مشاهدهٔ لیست خرید
          </a>
        </div>
        {available > 0 ? (
          <AddAllIngredientsButton products={products} />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
