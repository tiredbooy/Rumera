import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";

import { OptimizedImage } from "@/components/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { faNum, formatPrice } from "@/lib/products";

import { ProductCardActions } from "./product-card-actions";

export const PRODUCT_CARD_GRID_CLASS =
  "grid grid-cols-1 gap-7 sm:grid-cols-[repeat(auto-fill,minmax(21rem,1fr))]";

/** Luxe storefront card backed only by the real product-list projection. */
export function ProductCard({ product }: { product: ProductListItem }) {
  const href = product.slug
    ? `/products/${encodeURIComponent(product.slug)}`
    : null;
  const hasActiveVariants = product.active_variant_count > 0;
  const hasAvailableVariants = product.available_variant_count > 0;
  const hasPrice = product.min_price > 0;
  const ranged = hasPrice && product.max_price > product.min_price;
  const image = product.image_response;
  const imageAlt = image?.alt_text?.trim() || product.title;
  const monogram = product.title.trim().charAt(0) || "ر";
  const visibleTags = product.tags?.slice(0, 2) ?? [];
  const hiddenTagCount = Math.max(
    (product.tags?.length ?? 0) - visibleTags.length,
    0,
  );
  const availability = hasAvailableVariants
    ? { label: "آمادهٔ سفارش", tone: "bg-emerald-500" }
    : hasActiveVariants
      ? { label: "ناموجود", tone: "bg-destructive" }
      : { label: "در حال تأمین", tone: "bg-muted-foreground" };

  const imageContent = (
    <OptimizedImage
      imageKey={image?.storage_key}
      src={image?.image_url}
      alt={imageAlt}
      width={800}
      format="webp"
      quality={82}
      widths={[320, 480, 640, 800]}
      fit="cover"
      sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 727px) calc(100vw - 4rem), (max-width: 1023px) calc((100vw - 5.5rem) / 2), (max-width: 1279px) calc((100vw - 7.5rem) / 2), 24rem"
      monogram={monogram}
      className="h-full w-full transition-transform duration-500 ease-cellar group-hover/product:scale-[1.035] motion-reduce:transition-none"
      fallbackClassName="from-accent/45 via-card to-secondary"
    />
  );

  return (
    <Card
      asChild
      className="group/product border-hairline shadow-e2 relative h-full min-w-0 gap-0 bg-card py-0 [container-type:inline-size] transition-[transform,box-shadow,border-color] duration-300 ease-cellar hover:-translate-y-1 hover:border-primary/25 hover:shadow-e3 focus-within:ring-2 focus-within:ring-primary/40 motion-reduce:transform-none motion-reduce:transition-none!"
    >
      <article>
        <div className="relative m-2 mb-0 aspect-square overflow-hidden rounded-[min(var(--radius-3xl),20px)] bg-secondary ring-1 ring-foreground/5">
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

          {product.category ? (
            <Badge
              variant="secondary"
              className="pointer-events-none absolute start-3 top-3 z-20 min-h-8 max-w-[60%] truncate border border-border/70 bg-background px-3 text-[11px] font-semibold text-foreground shadow-e1"
            >
              {product.category}
            </Badge>
          ) : null}

          <ProductCardActions
            productId={product.id}
            productTitle={product.title}
            productHref={href}
            purchasableVariantId={product.purchasable_variant_id}
            hasActiveVariants={hasActiveVariants}
            hasAvailableVariants={hasAvailableVariants}
          />
        </div>

        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex min-h-6 min-w-0 items-center justify-between gap-3">
            {product.brand ? (
              <p className="min-w-0 truncate text-xs font-semibold text-primary">
                {product.brand}
              </p>
            ) : (
              <span aria-hidden />
            )}
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${availability.tone}`}
                aria-hidden
              />
              {availability.label}
            </span>
          </div>

          <h3 className="mt-3 line-clamp-2 min-h-16 font-serif text-[1.4rem] leading-8 text-foreground transition-colors duration-200 group-hover/product:text-primary motion-reduce:transition-none">
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
              className="mt-3 flex min-h-7 min-w-0 items-center gap-1.5 overflow-hidden"
            >
              {visibleTags.map((tag) => (
                <Badge
                  key={tag.id}
                  role="listitem"
                  variant="secondary"
                  title={tag.title}
                  className="min-h-7 max-w-36 min-w-0 shrink truncate border border-primary/10 bg-accent/70 px-2.5 text-[11px] text-foreground"
                >
                  {tag.title}
                </Badge>
              ))}
              {hiddenTagCount ? (
                <Badge
                  role="listitem"
                  variant="outline"
                  aria-label={`${faNum(hiddenTagCount)} برچسب دیگر`}
                  className="min-h-7 shrink-0 px-2.5 text-[11px] text-muted-foreground"
                >
                  +{faNum(hiddenTagCount)}
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 min-h-7" aria-hidden />
          )}

          <div className="mt-auto pt-6">
            <div className="flex min-h-16 items-end justify-between gap-4 border-t border-border/60 pt-4">
              <div className="min-w-0">
                {hasPrice ? (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      {ranged ? "شروع قیمت از" : "قیمت"}
                    </p>
                    <p
                      data-product-price
                      className="mt-1 whitespace-nowrap font-serif text-[clamp(1.1rem,6cqi,1.65rem)] leading-tight text-foreground"
                    >
                      {formatPrice(product.min_price)}
                    </p>
                  </>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Boxes className="size-4" aria-hidden />
                    {hasActiveVariants ? "قیمت ثبت نشده" : "در حال تأمین"}
                  </span>
                )}
              </div>

              {href ? (
                <Button
                  asChild
                  variant="ghost"
                  className="h-11 shrink-0 rounded-2xl px-3 font-semibold text-primary hover:bg-accent"
                >
                  <Link href={href}>
                    جزئیات
                    <ArrowLeft className="size-4 transition-transform duration-200 group-hover/button:-translate-x-1 motion-reduce:transition-none" />
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
