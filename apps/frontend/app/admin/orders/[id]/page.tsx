import { notFound } from "next/navigation";

import { OrderDetailView } from "@/features/admin/orders/components/order-detail-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.ORDERS_READ);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  const canWrite = can(session, PERMISSIONS.ORDERS_WRITE);
  return <OrderDetailView orderId={orderId} canWrite={canWrite} />;
}
