import {
  InventoryListView,
  type InventorySearchParams,
} from "@/features/admin/inventory/components/inventory-list-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<InventorySearchParams>;
}) {
  const session = await requirePermission(PERMISSIONS.INVENTORY_READ);
  const canWrite = can(session, PERMISSIONS.INVENTORY_WRITE);
  return (
    <InventoryListView
      searchParams={await searchParams}
      canWrite={canWrite}
    />
  );
}
