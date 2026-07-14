import { CheckoutFlow } from "@/features/checkout/components/checkout-flow"

export default function CheckoutPage() {
  return (
    <section className="container-px mx-auto max-w-7xl py-8 pb-28 lg:py-12 lg:pb-12">
      <header className="max-w-2xl">
        <p className="eyebrow">تسویه حساب</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">تکمیل سفارش</h1>
      </header>
      <CheckoutFlow />
    </section>
  )
}
