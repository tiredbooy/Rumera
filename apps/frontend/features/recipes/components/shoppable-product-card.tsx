import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { StorefrontMedia } from "@/components/storefront-media";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import {
  alternativeSearchHref,
  productDetailHref,
  productShopAnchor,
} from "@/features/recipes/commerce";
import type { ShoppableProduct } from "@/features/recipes/types";
import {
  formatRecipeProductRole,
  formatRecipeQuantity,
} from "@/features/recipes/utils";
import { faNum, formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

export function ShoppableProductCard({
  product,
}: {
  product: ShoppableProduct;
}) {
  const pdp = productDetailHref(product);
  const onSale =
    product.compare_at_price != null &&
    product.compare_at_price > product.price;
  const measure = [
    product.quantity ? formatRecipeQuantity(product.quantity) : undefined,
    product.unit,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const roleLabel = formatRecipeProductRole(product.role);
  const altHref = alternativeSearchHref(product.product_title);
  const anchor = productShopAnchor(product.product_variant_id);

  return (
    <article
      id={anchor}
      className={cn(
        "border-hairline shadow-e1 flex h-full flex-col gap-4 scroll-mt-28 rounded-3xl bg-card p-5 ring-1 ring-foreground/5",
        "transition-shadow duration-300 hover:shadow-e3",
      )}
      data-shoppable-product={product.product_variant_id}
      data-available={product.is_available ? "true" : "false"}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl">
        <StorefrontMedia
          slot="recipe-product"
          src={product.image_url}
          alt={product.product_title}
          monogram={product.product_title.charAt(0)}
        />
        {!product.is_available ? (
          <span className="absolute inset-x-3 bottom-3 rounded-full bg-background/90 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground backdrop-blur-sm">
            {product.available_stock === 0
              ? "ناموجود"
              : "فعلاً قابل خرید نیست"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col">
        {roleLabel ? (
          <span className="text-xs font-medium text-primary">{roleLabel}</span>
        ) : product.is_primary ? (
          <span className="text-xs font-medium text-primary">پایهٔ اصلی</span>
        ) : null}

        <h3 className="mt-1 font-serif text-lg leading-tight">
          {pdp ? (
            <Link
              href={pdp}
              className="min-h-11 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

        {Number.isFinite(product.price) ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="font-serif text-xl">
              {formatPrice(product.price)}
            </span>
            {onSale ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            ) : null}
            {product.is_available && product.available_stock > 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {faNum(product.available_stock)} عدد موجود
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">قیمت در دسترس نیست</p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {product.is_available ? (
            <AddToCartButton
              productVariantId={product.product_variant_id}
              productId={product.product_id}
              className="h-11 w-full"
              ariaLabel={`افزودن ${product.product_title} به سبد خرید`}
            />
          ) : (
            <>
              <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center text-sm font-medium text-muted-foreground">
                {product.available_stock === 0
                  ? "ناموجود در حال حاضر"
                  : "فعلاً قابل خرید نیست"}
              </p>
              <Button
                asChild
                variant="outline"
                className="h-11 w-full"
              >
                <Link href={altHref}>
                  <PackageSearch className="size-4" aria-hidden />
                  یافتن جایگزین
                </Link>
              </Button>
              {pdp ? (
                <Button asChild variant="ghost" className="h-11 w-full">
                  <Link href={pdp}>مشاهدهٔ محصول</Link>
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
