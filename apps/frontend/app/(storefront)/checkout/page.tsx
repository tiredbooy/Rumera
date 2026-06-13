import { CheckoutFlow } from "@/components/checkout/checkout-flow"

export default function CheckoutPage() {
  return (
    <section className="container-px mx-auto max-w-6xl py-12">
      <h1 className="font-serif text-5xl">تسویه حساب</h1>
      <CheckoutFlow />
    </section>
  )
}
