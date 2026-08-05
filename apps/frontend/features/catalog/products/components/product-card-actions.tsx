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
import { cn } from "@/lib/utils";

interface ProductCardActionsProps {
  productId: number;
  productTitle: string;
  productHref: string | null;
  purchasableVariantId?: number;
  hasActiveVariants: boolean;
  hasAvailableVariants: boolean;
}

/**
 * Overlay commerce controls for ProductCard.
 *
 * Mobile: always visible over the bottom media scrim (no hover dependency).
 * Desktop: CTA lifts slightly on card hover; wishlist stays glass-chrome.
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
  const wishlist = useWishlist(
    authenticated && purchasableVariantId !== undefined,
  );
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
      {purchasableVariantId ? (
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
            "absolute end-3 top-3 z-20 flex size-11 cursor-pointer items-center justify-center rounded-full",
            "border border-border/50 bg-background/85 text-foreground shadow-e1 backdrop-blur-md",
            "outline-none transition-[color,background-color,transform,box-shadow] duration-200",
            "hover:scale-105 hover:bg-background hover:text-wine hover:shadow-e2",
            "focus-visible:ring-2 focus-visible:ring-primary",
            "disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none motion-reduce:hover:scale-100",
            wishlistItem && "border-wine/30 text-wine",
          )}
        >
          {wishPending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Heart className={cn("size-4", wishlistItem && "fill-current")} />
          )}
        </button>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-3 bottom-3 z-20 translate-y-0 opacity-100 transition-[transform,opacity] duration-300 ease-cellar",
          "sm:translate-y-1 sm:opacity-95 sm:group-hover/product:translate-y-0 sm:group-hover/product:opacity-100",
          "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        )}
      >
        {purchasableVariantId ? (
          <AddToCartButton
            productVariantId={purchasableVariantId}
            productId={productId}
            label="افزودن سریع"
            ariaLabel={`افزودن سریع ${productTitle} به سبد`}
            className="h-11 w-full rounded-2xl bg-primary/95 px-4 text-primary-foreground shadow-e2 backdrop-blur-sm hover:bg-primary"
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
