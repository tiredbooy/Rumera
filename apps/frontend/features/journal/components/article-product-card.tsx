import Link from "next/link";

import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import type { ProductDetail } from "@/features/catalog/products/types";
import { formatPrice } from "@/lib/products";

export function ArticleProductCard({ product }: { product: ProductDetail }) {
  const activeVariants = (product.variants ?? []).filter(
    (variant) => variant.is_active && variant.price > 0,
  );
  const availableVariants = activeVariants
    .filter((variant) => (variant.available_stock ?? 0) > 0)
    .sort((a, b) => a.price - b.price);
  const purchasableVariant =
    availableVariants.length === 1 ? availableVariants[0] : undefined;
  const displayVariant =
    purchasableVariant ??
    activeVariants.slice().sort((a, b) => a.price - b.price)[0];
  const image =
    (product.images ?? []).find((i) => i.is_primary) ?? product.images?.[0];
  const onSale =
    displayVariant?.compare_at_price != null &&
    displayVariant.compare_at_price > displayVariant.price;
  const slug = product.slug?.trim();
  const pdp = slug ? `/products/${encodeURIComponent(slug)}` : null;

  return (
    <article className="border-hairline flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5">
      <div className="relative block aspect-square overflow-hidden rounded-2xl">
        <SmartImage
          src={image?.image_url}
          alt={image?.alt_text ?? product.title}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          monogram={product.title.charAt(0)}
        />
      </div>
      <div className="flex flex-1 flex-col">
        <h3 className="font-serif text-lg leading-tight">
          {pdp ? (
            <Link
              href={pdp}
              className="rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {product.title}
            </Link>
          ) : (
            product.title
          )}
        </h3>
        {displayVariant ? (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-xl">
              {formatPrice(displayVariant.price)}
            </span>
            {onSale ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(displayVariant.compare_at_price!)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4">
          {purchasableVariant ? (
            <AddToCartButton
              productVariantId={purchasableVariant.id}
              className="w-full"
            />
          ) : pdp ? (
            <Button variant="outline" asChild className="h-12 w-full">
              <Link href={pdp}>
                {availableVariants.length > 1
                  ? "انتخاب گزینه‌ها"
                  : displayVariant
                    ? "بررسی زمان موجودشدن"
                    : "مشاهدهٔ محصول"}
              </Link>
            </Button>
          ) : (
            <p className="rounded-xl bg-secondary/60 px-3 py-3 text-center text-sm text-muted-foreground">
              این محصول هم‌اکنون قابل خرید نیست
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
