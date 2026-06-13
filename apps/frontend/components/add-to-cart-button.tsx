"use client"

import { ShoppingBag } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { formatPrice, type Product } from "@/lib/products"

/** Adds a product to the cart (toast for now; wire to /api/v1/cart later). */
export function AddToCartButton({ product }: { product: Pick<Product, "name" | "price"> }) {
  return (
    <Button
      size="lg"
      className="h-12 px-7 text-sm"
      onClick={() =>
        toast.success("به سبد خرید افزوده شد", {
          description: `${product.name} — ${formatPrice(product.price)}`,
        })
      }
    >
      <ShoppingBag /> افزودن به سبد
    </Button>
  )
}
