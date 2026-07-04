import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { OrdersTable } from "@/features/admin/orders/components/OrdersTable";

export default async function AdminOrdersPage() {
  await requirePermission(PERMISSIONS.ORDERS_READ);

  return (
    <>
      <PageHeader
        title="سفارش‌ها"
        description="مدیریت و پیگیری سفارش‌های فروشگاه."
      />
      <OrdersTable />
    </>
  );
}
