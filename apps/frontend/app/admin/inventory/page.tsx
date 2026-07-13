import { Boxes, PackageX, AlertTriangle, Wallet } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { formatPrice, faNum } from "@/lib/products";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { InventoryTable } from "@/features/admin/inventory/components/InventoryTable";
import { listAllInventory } from "@/features/inventory/api";

export default async function AdminInventoryPage() {
  const session = await requirePermission(PERMISSIONS.INVENTORY_READ);
  const canWrite = can(session, PERMISSIONS.INVENTORY_WRITE);
  const inventory = await listAllInventory();
  const s = {
    skuCount: inventory.length,
    outOfStock: inventory.filter((row) => row.available_stock <= 0).length,
    lowStock: inventory.filter(
      (row) =>
        row.available_stock > 0 &&
        row.available_stock <= row.reorder_point,
    ).length,
    stockValue: inventory.reduce(
      (total, row) => total + row.stock_on_hand * Number(row.unit_price),
      0,
    ),
  };

  return (
    <>
      <PageHeader
        title="موجودی"
        description="پایش موجودی انبار و هشدار کسری."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="تعداد کالا" value={faNum(s.skuCount)} icon={Boxes} />
        <StatCard
          label="ناموجود"
          value={faNum(s.outOfStock)}
          icon={PackageX}
          hint="نیازمند تأمین"
        />
        <StatCard
          label="رو به اتمام"
          value={faNum(s.lowStock)}
          icon={AlertTriangle}
          hint="کمتر از آستانه"
        />
        <StatCard
          label="ارزش موجودی"
          value={formatPrice(s.stockValue)}
          icon={Wallet}
        />
      </div>

      <InventoryTable canWrite={canWrite} inventory={inventory} />
    </>
  );
}
