import type { Metadata } from "next"

import { buildMetadata } from "@/lib/seo/metadata"
import { CartView } from "@/components/cart/cart-view"

// Carts are personal & volatile — keep them out of the index.
export const metadata: Metadata = buildMetadata({ title: "سبد خرید", path: "/cart", index: false })

export default function CartPage() {
  return (
    <section className="container-px mx-auto max-w-6xl py-12">
      <h1 className="font-serif text-5xl">سبد خرید</h1>
      <CartView />
    </section>
  )
}
