"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Loader2, ShoppingBag, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useBulkAddCartItems } from "@/features/cart/api"
import { faNum } from "@/lib/products"
import type { ShoppableProduct } from "@/features/recipes/types"

/**
 * AddAllIngredientsButton — one tap adds every in-stock product of a recipe to
 * the cart. Out-of-stock items are skipped server-side and surfaced in the toast,
 * so the shopper always knows exactly what landed in the basket.
 */
export function AddAllIngredientsButton({ products }: { products: ShoppableProduct[] }) {
  const { status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const bulkAdd = useBulkAddCartItems()
  const [done, setDone] = React.useState(false)

  const available = products.filter((p) => p.is_available)
  if (available.length === 0) return null

  function onClick() {
    if (status !== "authenticated") {
      toast.info("برای افزودن به سبد ابتدا وارد شوید")
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
      return
    }

    bulkAdd.mutate(
      available.map((p) => ({ product_variant_id: p.product_variant_id, quantity: 1 })),
      {
        onSuccess: (res) => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1800)
          const skipped = res.skipped.length
          toast.success(
            skipped === 0
              ? `${faNum(res.added)} مورد به سبد خرید افزوده شد`
              : `${faNum(res.added)} از ${faNum(res.added + skipped)} مورد افزوده شد`,
            {
              description: skipped > 0 ? "برخی موارد ناموجود بودند." : undefined,
              action: { label: "مشاهدهٔ سبد", onClick: () => router.push("/cart") },
            }
          )
        },
        onError: () => toast.error("افزودن به سبد ناموفق بود"),
      }
    )
  }

  return (
    <Button
      size="lg"
      onClick={onClick}
      disabled={bulkAdd.isPending}
      aria-label={`افزودن همهٔ مواد (${faNum(available.length)} مورد)`}
      className="h-12 shrink-0 cursor-pointer px-6 text-sm"
    >
      {bulkAdd.isPending ? (
        <Loader2 className="animate-spin" />
      ) : done ? (
        <Check />
      ) : (
        <ShoppingBag />
      )}
      {done ? "افزوده شد" : `افزودن همهٔ مواد (${faNum(available.length)})`}
    </Button>
  )
}
