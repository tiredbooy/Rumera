"use client";

import Link from "next/link";
import { Heart, Loader2, SlidersHorizontal, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { useRecordInteraction } from "@/features/recommendations/hooks";
import {
  useAddWishlistItem,
  useRemoveWishlistItem,
  useWishlist,
} from "@/features/wishlist/hooks";
import { stashWishlistIntent } from "@/features/wishlist/pending-wishlist";
import { cn } from "@/lib/utils";

interface ProductCardActionsProps {
  productId: number;
  productTitle: string;
  productHref: string | null;
  purchasableVariantId?: number;
  hasActiveVariants: boolean;
  hasAvailableVariants: boolean;
}

export const PRODUCT_CARD_ACTIONS_OVERLAY_CLASS = cn(
  "absolute inset-x-3 bottom-3 z-20 transition-[transform,opacity] duration-300 ease-cellar",
  "pointer-events-none translate-y-1 opacity-0",
  "[@media(hover:hover)_and_(pointer:fine)]:group-hover/product:pointer-events-auto",
  "[@media(hover:hover)_and_(pointer:fine)]:group-hover/product:translate-y-0",
  "[@media(hover:hover)_and_(pointer:fine)]:group-hover/product:opacity-100",
  "group-focus-within/product:pointer-events-auto group-focus-within/product:translate-y-0 group-focus-within/product:opacity-100",
  "motion-reduce:transform-none motion-reduce:transition-none",
);

const HEART_CHROME_CLASS = cn(
  "absolute end-3 top-3 z-20 flex size-11 items-center justify-center rounded-full",
  "border border-border/50 bg-background/85 text-foreground shadow-e1 backdrop-blur-md",
  "transition-[color,background-color,box-shadow] duration-200",
  "hover:bg-background hover:text-wine hover:shadow-e2",
  "focus-visible:ring-2 focus-visible:ring-primary",
  "motion-reduce:transition-none",
);

/**
 * Overlay commerce controls for ProductCard.
 *
 * Wishlist stays in the corner: a real variant toggle when the list row
 * resolved one purchasable variant, otherwise a PDP link (options first).
 * Quick-add / option CTAs stay off the media until fine-pointer hover or
 * keyboard focus. Touch users use the persistent purchase link in the card body.
 */
export function ProductCardActions({
  productId,
  productTitle,
  productHref,
  purchasableVariantId,
  hasActiveVariants,
  hasAvailableVariants,
}: ProductCardActionsProps) {
  const { status } = useSession();
  const router = useRouter();
  const authenticated = status === "authenticated";
  const canWishlistVariant = purchasableVariantId !== undefined;
  // List projection omits a variant id when options must be chosen.
  // Wishlist API is variant-scoped — never POST a product-level item.
  const canChooseOptionsOnPdp =
    !canWishlistVariant &&
    Boolean(productHref) &&
    hasActiveVariants &&
    hasAvailableVariants;
  const wishlist = useWishlist(authenticated && canWishlistVariant);
  const addWishlist = useAddWishlistItem();
  const removeWishlist = useRemoveWishlistItem();
  const recordInteraction = useRecordInteraction();
  const wishlistItem = wishlist.data?.items.find(
    (item) => item.variant_id === purchasableVariantId,
  );
  const wishPending = addWishlist.isPending || removeWishlist.isPending;

  function toggleWishlist() {
    if (!purchasableVariantId) return;
    if (status === "loading") return;
    if (!authenticated) {
      stashWishlistIntent({
        product_variant_id: purchasableVariantId,
        product_id: productId,
      });
      toast.info("برای افزودن به علاقه‌مندی‌ها وارد شوید");
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (wishlistItem) {
      removeWishlist.mutate(wishlistItem.id, {
        onSuccess: () => toast.success("از علاقه‌مندی‌ها حذف شد"),
        onError: () => toast.error("حذف از علاقه‌مندی‌ها ناموفق بود"),
      });
      return;
    }

    addWishlist.mutate(purchasableVariantId, {
      onSuccess: () => {
        toast.success("به علاقه‌مندی‌ها افزوده شد");
        recordInteraction.mutate({
          product_id: productId,
          interaction_type: "wishlist",
          source: "product_card",
        });
      },
      onError: () => toast.error("افزودن به علاقه‌مندی‌ها ناموفق بود"),
    });
  }

  return (
    <>
      {canWishlistVariant ? (
        <button
          type="button"
          onClick={toggleWishlist}
          disabled={wishPending || status === "loading"}
          aria-label={
            wishlistItem
              ? `حذف ${productTitle} از علاقه‌مندی‌ها`
              : `افزودن ${productTitle} به علاقه‌مندی‌ها`
          }
          aria-pressed={Boolean(wishlistItem)}
          className={cn(
            HEART_CHROME_CLASS,
            "cursor-pointer disabled:cursor-wait disabled:opacity-70",
            wishlistItem && "border-wine/30 text-wine",
          )}
        >
          {wishPending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Heart className={cn("size-4", wishlistItem && "fill-current")} />
          )}
        </button>
      ) : canChooseOptionsOnPdp && productHref ? (
        <Link
          href={productHref}
          aria-label={`برای افزودن ${productTitle} به علاقه‌مندی‌ها ابتدا گزینه را انتخاب کنید`}
          className={cn(HEART_CHROME_CLASS, "cursor-pointer")}
        >
          <Heart className="size-4" aria-hidden />
        </Link>
      ) : null}

      <div
        className={PRODUCT_CARD_ACTIONS_OVERLAY_CLASS}
      >
        {purchasableVariantId ? (
          <AddToCartButton
            productVariantId={purchasableVariantId}
            productId={productId}
            label="افزودن سریع"
            ariaLabel={`افزودن سریع ${productTitle} به سبد`}
            className="h-11 w-full rounded-2xl bg-primary/95 px-4 text-primary-foreground shadow-e2 backdrop-blur-sm hover:bg-primary max-sm:text-xs"
          />
        ) : hasActiveVariants && hasAvailableVariants && productHref ? (
          <Button
            asChild
            variant="secondary"
            className="h-11 w-full rounded-2xl border border-border/50 bg-background/90 text-foreground shadow-e2 backdrop-blur-md hover:bg-background"
          >
            <Link href={productHref}>
              <SlidersHorizontal className="size-4" aria-hidden />
              انتخاب گزینه‌ها
            </Link>
          </Button>
        ) : hasActiveVariants && hasAvailableVariants ? (
          <Button
            type="button"
            variant="secondary"
            disabled
            className="h-11 w-full rounded-2xl bg-background/90 text-foreground shadow-e2 backdrop-blur-md"
          >
            انتخاب گزینه در دسترس نیست
          </Button>
        ) : hasActiveVariants ? (
          <Button
            type="button"
            variant="secondary"
            disabled
            className="h-11 w-full rounded-2xl bg-background/90 text-foreground shadow-e2 backdrop-blur-md"
          >
            <ShoppingBag className="size-4 opacity-70" aria-hidden />
            ناموجود
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled
            className="h-11 w-full rounded-2xl bg-background/90 text-foreground shadow-e2 backdrop-blur-md"
          >
            در حال تأمین
          </Button>
        )}
      </div>
    </>
  );
}
