import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";

import { StorefrontMedia } from "@/components/storefront-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  catalogueAvailability,
  cataloguePriceDisplay,
  isQuickPurchasable,
  productPublicHref,
} from "@/features/catalog/products/catalogue-presentation";
import { lowStockLabel } from "@/features/catalog/products/stock-display";
import type { ProductListItem } from "@/features/catalog/products/types";
import { faNum, formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

import { ProductCardActions } from "./product-card-actions";

/**
 * Dense-but-readable auto-fill grid. `minmax(17.5rem,1fr)` keeps two columns on
 * mid phones and avoids the previous 21rem floor that forced single-column too
 * early on common viewports.
 */
export const PRODUCT_CARD_GRID_CLASS =
  "grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] sm:gap-6 lg:gap-7";

/**
 * Stable media frame for every product card surface (grid, rail, search).
 * Fixed 4:3 aspect — shorter than the old 4:5 portrait so cards stay compact
 * and aligned; cover-fit keeps imagery filled without stretching.
 */
export const PRODUCT_CARD_MEDIA_FRAME_CLASS =
  "relative m-2 mb-0 aspect-[4/3] shrink-0 overflow-hidden rounded-[min(var(--radius-3xl),1.25rem)] bg-secondary ring-1 ring-foreground/5";

const AVAILABILITY_CHIP: Record<
  ReturnType<typeof catalogueAvailability>["kind"],
  { tone: string; chip: string }
> = {
  ready: {
    tone: "bg-emerald-500",
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  out_of_stock: {
    tone: "bg-destructive",
    chip: "border-destructive/20 bg-destructive/10 text-destructive",
  },
  unconfigured: {
    tone: "bg-muted-foreground",
    chip: "border-border/70 bg-muted/80 text-muted-foreground",
  },
};

const LOW_STOCK_CHIP = {
  tone: "bg-amber-500",
  chip: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

/** Luxe storefront card backed only by the real product-list projection. */
export function ProductCard({
  product,
  priority = false,
  className,
}: {
  product: ProductListItem;
  /** Prefer for above-the-fold homepage rows. */
  priority?: boolean;
  className?: string;
}) {
  const href = productPublicHref(product);
  const hasActiveVariants = product.active_variant_count > 0;
  const hasAvailableVariants = product.available_variant_count > 0;
  const purchasableVariantId = isQuickPurchasable(product)
    ? product.purchasable_variant_id
    : undefined;
  const price = cataloguePriceDisplay(product);
  const image = product.image_response;
  const imageAlt = image?.alt_text?.trim() || product.title;
  const monogram = product.title.trim().charAt(0) || "ر";
  const visibleTags = product.tags?.slice(0, 2) ?? [];
  const hiddenTagCount = Math.max(
    (product.tags?.length ?? 0) - visibleTags.length,
    0,
  );
  const availability = catalogueAvailability(product);
  const lowStock =
    availability.kind === "ready"
      ? lowStockLabel(product.available_stock)
      : null;
  const chip = lowStock ? LOW_STOCK_CHIP : AVAILABILITY_CHIP[availability.kind];

  const imageContent = (
    <StorefrontMedia
      slot="product-card"
      storageKey={image?.storage_key}
      src={image?.image_url}
      alt={imageAlt}
      monogram={monogram}
      intrinsicWidth={image?.width}
      intrinsicHeight={image?.height}
      priority={priority}
      className="transition-transform duration-300 ease-cellar group-hover/product:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
    />
  );

  return (
    <Card
      asChild
      className={cn(
        "group/product border-hairline shadow-e2 relative h-full min-w-0 gap-0 overflow-hidden bg-card py-0",
        "[container-type:inline-size]",
        "transition-[transform,box-shadow,border-color] duration-300 ease-cellar",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-e3",
        "focus-within:ring-2 focus-within:ring-primary/40",
        "motion-reduce:transform-none motion-reduce:transition-none!",
        className,
      )}
    >
      <article className="flex h-full min-w-0 flex-col">
        {/* Media — fixed 4:3 frame; actions float over glass chrome */}
        <div className={PRODUCT_CARD_MEDIA_FRAME_CLASS}>
          {href ? (
            <Link
              href={href}
              aria-label={`مشاهدهٔ ${product.title}`}
              className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              {imageContent}
            </Link>
          ) : (
            <div className="absolute inset-0">{imageContent}</div>
          )}

          {/* Soft bottom scrim appears only with the hover/focus commerce overlay. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-20 bg-gradient-to-t from-background/80 via-background/25 to-transparent opacity-0 transition-opacity duration-300 group-focus-within/product:opacity-100 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/product:opacity-100"
          />

          {/* Sheen catch-light (matches recommendation rail language) */}
          <span
            aria-hidden
            className="sheen pointer-events-none absolute inset-0 z-[12] -translate-x-full opacity-0 transition-[transform,opacity] duration-300 ease-cellar group-hover/product:translate-x-full group-hover/product:opacity-100 motion-reduce:hidden"
          />

          {product.category ? (
            <Badge
              variant="secondary"
              className="pointer-events-none absolute start-3 top-3 z-20 min-h-8 max-w-[55%] truncate border border-border/50 bg-background/85 px-3 text-[11px] font-semibold text-foreground shadow-e1 backdrop-blur-md"
            >
              {product.category}
            </Badge>
          ) : null}

          <ProductCardActions
            productId={product.id}
            productTitle={product.title}
            productHref={href}
            purchasableVariantId={purchasableVariantId}
            hasActiveVariants={hasActiveVariants}
            hasAvailableVariants={hasAvailableVariants}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 p-4 sm:p-5">
          <div className="flex min-h-6 min-w-0 items-center justify-between gap-2">
            {product.brand ? (
              <p className="min-w-0 truncate text-[11px] font-semibold tracking-wide text-primary sm:text-xs">
                {product.brand}
              </p>
            ) : (
              <span aria-hidden className="min-w-0" />
            )}
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-[11px]",
                chip.chip,
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", chip.tone)}
                aria-hidden
              />
              {lowStock ?? availability.label}
            </span>
          </div>

          <h3 className="mt-2.5 line-clamp-2 min-h-[2.75rem] font-serif text-[clamp(1.05rem,5.5cqi,1.35rem)] leading-snug text-foreground transition-colors duration-200 group-hover/product:text-primary motion-reduce:transition-none">
            {href ? (
              <Link
                href={href}
                className="flex min-h-11 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {product.title}
              </Link>
            ) : (
              product.title
            )}
          </h3>

          {visibleTags.length ? (
            <div
              role="list"
              aria-label="برچسب‌های محصول"
              className="mt-2.5 flex min-h-7 min-w-0 items-center gap-1.5 overflow-hidden"
            >
              {visibleTags.map((tag) => (
                <Badge
                  key={tag.id}
                  role="listitem"
                  variant="secondary"
                  title={tag.title}
                  className="min-h-7 max-w-32 min-w-0 shrink truncate border border-primary/10 bg-accent/60 px-2 text-[10px] text-foreground sm:max-w-36 sm:px-2.5 sm:text-[11px]"
                >
                  {tag.title}
                </Badge>
              ))}
              {hiddenTagCount ? (
                <Badge
                  role="listitem"
                  variant="outline"
                  aria-label={`${faNum(hiddenTagCount)} برچسب دیگر`}
                  className="min-h-7 shrink-0 px-2 text-[10px] text-muted-foreground sm:px-2.5 sm:text-[11px]"
                >
                  +{faNum(hiddenTagCount)}
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="mt-2.5 min-h-7" aria-hidden />
          )}

          <div className="mt-auto pt-4">
            <div className="flex min-h-14 items-end justify-between gap-3 border-t border-border/50 pt-3.5">
              <div className="min-w-0">
                {price.kind === "single" || price.kind === "range" ? (
                  <>
                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground sm:text-[11px]">
                      {price.ranged ? "شروع قیمت از" : "قیمت"}
                    </p>
                    <p
                      data-product-price
                      className="mt-0.5 whitespace-nowrap font-serif text-[clamp(1.05rem,5.5cqi,1.55rem)] leading-tight text-foreground"
                    >
                      {formatPrice(price.amount)}
                    </p>
                  </>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Boxes className="size-4 shrink-0" aria-hidden />
                    {price.kind === "unconfigured"
                      ? "در حال تأمین"
                      : "قیمت در دسترس نیست"}
                  </span>
                )}
              </div>

              {href ? (
                <Button
                  asChild
                  variant="ghost"
                  className="h-11 shrink-0 rounded-2xl px-3 font-semibold text-primary hover:bg-accent"
                >
                  <Link
                    href={href}
                    aria-label={`مشاهده و خرید ${product.title}`}
                  >
                    <span className="[@media(any-pointer:coarse)]:hidden">
                      جزئیات
                    </span>
                    <span className="hidden [@media(any-pointer:coarse)]:inline">
                      مشاهده و خرید
                    </span>
                    <ArrowLeft className="size-4 transition-transform duration-200 group-hover/product:-translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </Button>
              ) : (
                <span className="flex min-h-11 shrink-0 items-center rounded-2xl bg-muted px-3 text-xs text-muted-foreground">
                  بدون صفحهٔ عمومی
                </span>
              )}
            </div>
          </div>
        </div>
      </article>
    </Card>
  );
}
