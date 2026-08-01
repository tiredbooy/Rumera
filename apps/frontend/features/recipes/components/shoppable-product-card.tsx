import Link from "next/link";

import { SmartImage } from "@/components/smart-image";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import type { ShoppableProduct } from "@/features/recipes/types";
import {
  formatRecipeProductRole,
  formatRecipeQuantity,
} from "@/features/recipes/utils";
import { formatPrice } from "@/lib/products";

export function ShoppableProductCard({
  product,
}: {
  product: ShoppableProduct;
}) {
  const productSlug = product.product_slug?.trim();
  const pdp = productSlug
    ? `/products/${encodeURIComponent(productSlug)}`
    : null;
  const onSale =
    product.compare_at_price != null &&
    product.compare_at_price > product.price;

  const Image = (
    <div className="relative aspect-square overflow-hidden rounded-2xl">
      <SmartImage
        src={product.image_url}
        alt={product.product_title}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        monogram={product.product_title.charAt(0)}
      />
    </div>
  );

  // How much of this product the recipe calls for, e.g. «۶۰ میلی‌لیتر».
  const measure = [
    product.quantity ? formatRecipeQuantity(product.quantity) : undefined,
    product.unit,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const roleLabel = formatRecipeProductRole(product.role);

  return (
    <article
      className="border-hairline shadow-e1 flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5 transition-shadow duration-300 hover:shadow-e3"
      data-shoppable-product={product.product_variant_id}
    >
      {Image}

      <div className="flex flex-1 flex-col">
        {roleLabel ? (
          <span className="text-xs font-medium text-primary">
            {roleLabel}
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

        {product.price > 0 ? (
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
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            قیمت در دسترس نیست
          </p>
        )}

        <div className="mt-4">
          {product.is_available ? (
            <AddToCartButton
              productVariantId={product.product_variant_id}
              className="w-full"
              ariaLabel={`افزودن ${product.product_title} به سبد خرید`}
            />
          ) : (
            <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center text-sm font-medium text-muted-foreground">
              {product.available_stock === 0
                ? "ناموجود در حال حاضر"
                : "فعلاً قابل خرید نیست"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
