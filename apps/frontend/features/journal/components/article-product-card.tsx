import Link from "next/link";

import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import type { ProductDetail } from "@/features/catalog/products/types";
import { formatPrice } from "@/lib/products";

export function ArticleProductCard({
  product,
}: {
  product: ProductDetail;
}) {
  const activeVariants = (product.variants ?? []).filter((v) => v.is_active);
  const cheapest = activeVariants.slice().sort((a, b) => a.price - b.price)[0];
  const image =
    (product.images ?? []).find((i) => i.is_primary) ?? product.images?.[0];
  const onSale =
    cheapest?.compare_at_price != null &&
    cheapest.compare_at_price > cheapest.price;
  const pdp = `/products/${product.slug}`;

  return (
    <article className="border-hairline flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5">
      <Link
        href={pdp}
        className="relative block aspect-square overflow-hidden rounded-2xl"
      >
        <SmartImage
          src={image?.image_url}
          alt={image?.alt_text ?? product.title}
          sizes="(max-width: 640px) 100vw, 33vw"
          monogram={product.title.charAt(0)}
        />
      </Link>
      <div className="flex flex-1 flex-col">
        <h3 className="font-serif text-lg leading-tight">
          <Link href={pdp}>{product.title}</Link>
        </h3>
        {cheapest ? (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-xl">
              {formatPrice(cheapest.price)}
            </span>
            {onSale ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(cheapest.compare_at_price!)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4">
          {cheapest ? (
            <AddToCartButton productVariantId={cheapest.id} />
          ) : (
            <Button variant="outline" asChild className="h-12 w-full">
              <Link href={pdp}>مشاهدهٔ محصول</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
