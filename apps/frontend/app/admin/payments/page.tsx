import { requirePaymentAdmin } from "@/features/admin/payments/admin-only";
import { PaymentsBoard } from "@/features/admin/payments/components/payments-board";

export default async function AdminPaymentsPage() {
  await requirePaymentAdmin();
  return <PaymentsBoard />;
}
