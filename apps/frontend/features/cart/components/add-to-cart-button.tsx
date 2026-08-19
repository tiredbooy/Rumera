"use client";

import type { MouseEvent } from "react";
import { Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAddCartItem } from "@/features/cart/api";
import { cartMutationErrorMessage } from "@/features/cart/errors";
import { stashAddToCartIntent } from "@/features/cart/pending-intent";
import { useRecordInteraction } from "@/features/recommendations/hooks";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  productVariantId?: number;
  /** Catalog product id for recommendation signals (optional but preferred). */
  productId?: number;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  ariaLabel?: string;
}

/** Customer-scoped, variant-aware cart mutation used by commerce surfaces. */
export function AddToCartButton({
  productVariantId,
  productId,
  quantity = 1,
  disabled,
  className,
  label = "افزودن به سبد",
  ariaLabel,
}: AddToCartButtonProps) {
  const { status } = useSession();
  const router = useRouter();
  const add = useAddCartItem();
  const record = useRecordInteraction();

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    // Product cards nest this control over a media link — never navigate away.
    event.preventDefault();
    event.stopPropagation();

    if (status === "loading") return;

    const variantId = Number(productVariantId);
    const validVariant = Number.isFinite(variantId) && variantId >= 1;
    const qty = Number(quantity);
    const validQty = Number.isFinite(qty) && qty >= 1;

    if (status !== "authenticated") {
      // Stash before bouncing — <PendingCartIntent /> replays it exactly once
      // after login instead of dumping the shopper on an empty cart (U-8).
      if (validVariant && validQty) {
        stashAddToCartIntent({
          product_variant_id: Math.trunc(variantId),
          quantity: Math.trunc(qty),
        });
      }
      toast.info("برای افزودن به سبد ابتدا وارد شوید");
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (!validVariant) {
      toast.error("این محصول گزینهٔ قابل خرید ندارد");
      return;
    }

    if (!validQty) {
      toast.error("تعداد نامعتبر است");
      return;
    }

    add.mutate(
      { product_variant_id: Math.trunc(variantId), quantity: Math.trunc(qty) },
      {
        onSuccess: (cart) => {
          toast.success("به سبد خرید افزوده شد", {
            action: {
              label: "مشاهدهٔ سبد",
              onClick: () => router.push("/cart"),
            },
          });
          const resolvedProductId =
            productId ??
            cart.items.find((item) => item.variant_id === variantId)
              ?.product_id;
          if (resolvedProductId) {
            void record
              .mutateAsync({
                product_id: resolvedProductId,
                interaction_type: "add_to_cart",
                source: "cart_button",
              })
              .catch(() => undefined);
          }
        },
        onError: (error) => toast.error(cartMutationErrorMessage(error)),
      },
    );
  }

  return (
    <Button
      type="button"
      size="lg"
      className={cn("h-12 px-7 text-sm", className)}
      onClick={onClick}
      disabled={disabled || status === "loading" || add.isPending}
      aria-label={ariaLabel}
    >
      {add.isPending ? <Loader2 className="animate-spin" /> : <ShoppingBag />}
      {label}
    </Button>
  );
}
