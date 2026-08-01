"use client";

import Link from "next/link";
import { Heart, Loader2, SlidersHorizontal } from "lucide-react";
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
            "absolute end-3 top-3 z-20 flex size-11 cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background text-foreground shadow-e1 outline-none transition-[color,background-color,transform] duration-200 hover:bg-accent hover:text-wine focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none",
            wishlistItem && "text-wine",
          )}
        >
          {wishPending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Heart className={cn("size-4", wishlistItem && "fill-current")} />
          )}
        </button>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 z-20">
        {purchasableVariantId ? (
          <AddToCartButton
            productVariantId={purchasableVariantId}
            label="افزودن سریع"
            ariaLabel={`افزودن سریع ${productTitle} به سبد`}
            className="h-11 w-full rounded-2xl bg-primary px-4 text-primary-foreground shadow-e2 hover:bg-primary/90"
          />
        ) : hasActiveVariants && hasAvailableVariants && productHref ? (
          <Button
            asChild
            variant="secondary"
            className="h-11 w-full rounded-2xl bg-background text-foreground shadow-e2 hover:bg-accent"
          >
            <Link href={productHref}>
              <SlidersHorizontal /> انتخاب گزینه‌ها
            </Link>
          </Button>
        ) : hasActiveVariants && hasAvailableVariants ? (
          <Button
            type="button"
            variant="secondary"
            disabled
            className="h-11 w-full rounded-2xl bg-background text-foreground shadow-e2"
          >
            انتخاب گزینه در دسترس نیست
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled
            className="h-11 w-full rounded-2xl bg-background text-foreground shadow-e2"
          >
            ناموجود
          </Button>
        )}
      </div>
    </>
  );
}
