import type { Metadata } from "next";

import { buildMetadata } from "@/lib/seo/metadata";
import { CartView } from "@/features/cart/components/cart-view";

// Carts are personal & volatile — keep them out of the index.
export const metadata: Metadata = buildMetadata({
  title: "سبد خرید",
  path: "/cart",
  index: false,
});

export default function CartPage() {
  return (
    <section className="container-px mx-auto max-w-7xl py-10 pb-28 lg:py-14 lg:pb-14">
      <header className="max-w-2xl">
        <p className="eyebrow">سبد خرید</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">سبد خرید شما</h1>
        <p className="mt-3 text-muted-foreground">
          اقلام انتخابی‌تان را مرور کنید، سپس برای تکمیل خرید ادامه دهید.
        </p>
      </header>
      <CartView />
    </section>
  );
}
