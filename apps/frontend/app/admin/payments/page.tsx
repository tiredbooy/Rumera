import { PaymentsBoard } from "@/features/admin/payments/components/payments-board";
import { requireStaff } from "@/lib/auth/session";

export default async function AdminPaymentsPage() {
  await requireStaff("/admin/payments");
  return <PaymentsBoard />;
}
