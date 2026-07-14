import { CustomerDetailView } from "@/features/admin/customers/components/customer-detail-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const { id } = await params;
  const canWrite = can(session, PERMISSIONS.CUSTOMERS_WRITE);
  return <CustomerDetailView id={id} canWrite={canWrite} />;
}
