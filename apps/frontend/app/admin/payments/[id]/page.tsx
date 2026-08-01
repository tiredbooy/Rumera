import { notFound } from "next/navigation";

import { PaymentDetailView } from "@/features/admin/payments/components/payment-detail-view";
import { requireStaff } from "@/lib/auth/session";

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawID } = await params;
  if (!/^[1-9]\d*$/.test(rawID)) notFound();
  const id = Number(rawID);
  if (!Number.isSafeInteger(id)) notFound();

  await requireStaff(`/admin/payments/${id}`);
  return <PaymentDetailView paymentID={id} />;
}
