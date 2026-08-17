import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { OrdersTable } from "@/features/admin/orders/components/OrdersTable";
import {
  parseAdminOrderListParams,
  type AdminOrdersSearchParams,
} from "@/features/admin/orders/order-list-params";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<AdminOrdersSearchParams>;
}) {
  await requirePermission(PERMISSIONS.ORDERS_READ);
  const filters = parseAdminOrderListParams(await searchParams);

  // The table owns the page shell: it holds the filter bar and the pager.
  return <OrdersTable filters={filters} />;
}
