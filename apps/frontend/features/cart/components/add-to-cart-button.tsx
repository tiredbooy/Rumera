"use client";

import { Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAddCartItem } from "@/features/cart/api";
import { useRecordInteraction } from "@/features/recommendations/hooks";
import { ApiClientError } from "@/lib/api/store-client";
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

  function onClick() {
    if (status === "loading") return;
    if (status !== "authenticated") {
      toast.info("برای افزودن به سبد ابتدا وارد شوید");
      const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (!productVariantId) return;

    add.mutate(
      { product_variant_id: productVariantId, quantity },
      {
        onSuccess: (cart) => {
          toast.success("به سبد خرید افزوده شد", {
            action: { label: "مشاهدهٔ سبد", onClick: () => router.push("/cart") },
          });
          const resolvedProductId =
            productId ??
            cart.items.find((item) => item.variant_id === productVariantId)
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
        onError: (error) =>
          toast.error(
            error instanceof ApiClientError && error.code === "OUT_OF_STOCK"
              ? "موجودی کافی نیست"
              : "افزودن به سبد ناموفق بود",
          ),
      },
    );
  }

  return (
    <Button
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
