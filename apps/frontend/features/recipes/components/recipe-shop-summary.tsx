import { CheckCircle2, PackageX, ShoppingBag } from "lucide-react";

import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

/** Compact commerce readiness strip for the recipe ingredients column. */
export function RecipeShopSummary({
  linkedCount,
  availableCount,
  totalIngredients,
  shopHref,
}: {
  linkedCount: number;
  availableCount: number;
  totalIngredients: number;
  shopHref?: string;
}) {
  if (totalIngredients === 0) return null;

  const unlinked = Math.max(0, totalIngredients - linkedCount);
  const unavailable = Math.max(0, linkedCount - availableCount);

  return (
    <div
      className="mt-5 rounded-2xl border border-border/60 bg-secondary/40 p-4"
      data-recipe-shop-summary
    >
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ShoppingBag className="size-4 text-primary" aria-hidden />
        خلاصهٔ خرید
      </p>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <CheckCircle2
            className={cn(
              "size-3.5 shrink-0",
              availableCount > 0 ? "text-emerald-600" : "text-muted-foreground",
            )}
            aria-hidden
          />
          {availableCount > 0
            ? `${faNum(availableCount)} ماده آمادهٔ افزودن به سبد`
            : "فعلاً ماده‌ای برای افزودن مستقیم موجود نیست"}
        </li>
        {unavailable > 0 ? (
          <li className="flex items-center gap-2">
            <PackageX className="size-3.5 shrink-0 text-wine" aria-hidden />
            {faNum(unavailable)} مادهٔ لینک‌شده ناموجود است
          </li>
        ) : null}
        {unlinked > 0 ? (
          <li className="flex items-center gap-2">
            <span
              className="size-3.5 shrink-0 rounded-full border border-border"
              aria-hidden
            />
            {faNum(unlinked)} ماده بدون لینک فروشگاهی — از جستجو استفاده کنید
          </li>
        ) : null}
      </ul>
      {shopHref && availableCount > 0 ? (
        <a
          href={shopHref}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ShoppingBag className="size-4" aria-hidden />
          رفتن به خرید مواد
        </a>
      ) : null}
    </div>
  );
}
