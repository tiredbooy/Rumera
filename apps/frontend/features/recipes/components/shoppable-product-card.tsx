import Link from "next/link";

import { SmartImage } from "@/components/smart-image";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import type { ShoppableProduct } from "@/features/recipes/types";
import { formatPrice } from "@/lib/products";

export function ShoppableProductCard({
  product,
}: {
  product: ShoppableProduct;
}) {
  const pdp = product.product_slug ? `/products/${product.product_slug}` : null;
  const onSale =
    product.compare_at_price != null &&
    product.compare_at_price > product.price;

  const Image = (
    <div className="relative aspect-square overflow-hidden rounded-2xl">
      <SmartImage
        src={product.image_url}
        alt={product.product_title}
        sizes="(max-width: 640px) 100vw, 33vw"
        monogram={product.product_title.charAt(0)}
      />
    </div>
  );

  // How much of this product the recipe calls for, e.g. «۶۰ میلی‌لیتر».
  const measure = [product.quantity, product.unit]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <article
      className="border-hairline shadow-e1 flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5 transition-shadow duration-300 hover:shadow-e3"
      data-shoppable-product={product.product_variant_id}
    >
      {pdp ? (
        <Link
          href={pdp}
          aria-label={product.product_title}
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {Image}
        </Link>
      ) : (
        Image
      )}

      <div className="flex flex-1 flex-col">
        {product.role ? (
          <span className="text-xs font-medium text-primary">
            {product.role}
          </span>
        ) : product.is_primary ? (
          <span className="text-xs font-medium text-primary">پایهٔ اصلی</span>
        ) : null}

        <h3 className="mt-1 font-serif text-lg leading-tight">
          {pdp ? (
            <Link
              href={pdp}
              className="rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {product.product_title}
            </Link>
          ) : (
            product.product_title
          )}
        </h3>
        {product.brand ? (
          <p className="text-xs text-muted-foreground">{product.brand}</p>
        ) : null}

        {measure ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            برای این دستور:{" "}
            <span className="font-medium text-foreground/80">{measure}</span>
          </p>
        ) : null}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-xl">
            {formatPrice(product.price)}
          </span>
          {onSale ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          {product.is_available ? (
            <AddToCartButton
              productVariantId={product.product_variant_id}
              className="w-full"
            />
          ) : (
            <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center text-sm font-medium text-muted-foreground">
              ناموجود
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
