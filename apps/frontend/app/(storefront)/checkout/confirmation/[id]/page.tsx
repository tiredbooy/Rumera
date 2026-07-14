import { OrderConfirmationView } from "@/features/orders/components/order-confirmation-view"

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <OrderConfirmationView id={id} />
}
