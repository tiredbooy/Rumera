import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";

import { OptimizedImage } from "@/components/optimized-image";
import type { ProductListItem } from "@/features/catalog/products/types";
import { formatPrice } from "@/lib/products";

import { ProductCardActions } from "./product-card-actions";

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

  const imageContent = (
    <OptimizedImage
      imageKey={image?.storage_key}
      src={image?.image_url}
      alt={imageAlt}
      width={640}
      format="webp"
      quality={82}
      widths={[320, 480, 640, 800]}
      fit="cover"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
      monogram={monogram}
      className="h-full w-full transition-transform duration-500 ease-out group-hover/product:scale-[1.035] motion-reduce:transition-none"
      fallbackClassName="from-accent/45 via-card to-secondary"
    />
  );

  return (
    <article className="group/product border-hairline shadow-e1 hover:shadow-e3 relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:ring-primary/30 focus-within:ring-primary/40 motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative aspect-4/5 overflow-hidden bg-secondary">
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

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/45 via-transparent to-black/5 opacity-70 transition-opacity duration-300 group-hover/product:opacity-90 motion-reduce:transition-none" />

        {product.category ? (
          <span className="pointer-events-none absolute start-3 top-3 z-20 max-w-[60%] truncate rounded-full border border-white/15 bg-background/80 px-3 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md">
            {product.category}
          </span>
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

      <div className="flex flex-1 flex-col gap-2 border-t border-border/60 p-5 sm:p-6">
        <div className="min-h-5">
          {product.brand ? (
            <p className="truncate text-xs font-semibold tracking-wide text-primary">
              {product.brand}
            </p>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-serif text-xl leading-snug text-foreground transition-colors group-hover/product:text-primary sm:text-2xl">
          {href ? (
            <Link
              href={href}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {product.title}
            </Link>
          ) : (
            product.title
          )}
        </h3>

        <div className="mt-auto flex min-h-14 items-end justify-between gap-3 pt-3">
          <div className="min-w-0">
            {hasPrice ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  {ranged ? "شروع قیمت از" : "قیمت"}
                </p>
                <p className="truncate font-serif text-xl text-foreground sm:text-2xl">
                  {formatPrice(product.min_price)}
                </p>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Boxes className="size-4" /> در حال تأمین
              </span>
            )}
          </div>

          {href ? (
            <Link
              href={href}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
            >
              جزئیات
              <ArrowLeft className="size-4 transition-transform group-hover/product:-translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">بدون صفحهٔ عمومی</span>
          )}
        </div>
      </div>
    </article>
  );
}
