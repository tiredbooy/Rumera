"use client"

import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { ShoppingBag, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAddCartItem } from "@/lib/api/hooks"
import { ApiClientError } from "@/lib/api/store-client"

/**
 * Variant-aware add-to-cart. The backend cart is customer-scoped (no guest
 * cart), so unauthenticated users are routed to sign in first.
 */
export function AddToCartButton({
  productVariantId,
  disabled,
}: {
  productVariantId?: number
  disabled?: boolean
}) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const add = useAddCartItem()

  function onClick() {
    if (status !== "authenticated") {
      toast.info("برای افزودن به سبد ابتدا وارد شوید")
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
      return
    }
    if (!productVariantId) return
    add.mutate(
      { product_variant_id: productVariantId, quantity: 1 },
      {
        onSuccess: () =>
          toast.success("به سبد خرید افزوده شد", {
            action: { label: "مشاهدهٔ سبد", onClick: () => router.push("/cart") },
          }),
        onError: (e) =>
          toast.error(
            e instanceof ApiClientError && e.code === "OUT_OF_STOCK"
              ? "موجودی کافی نیست"
              : "افزودن به سبد ناموفق بود"
          ),
      }
    )
  }

  return (
    <Button
      size="lg"
      className="h-12 px-7 text-sm"
      onClick={onClick}
      disabled={disabled || add.isPending}
    >
      {add.isPending ? <Loader2 className="animate-spin" /> : <ShoppingBag />} افزودن به سبد
    </Button>
  )
}
