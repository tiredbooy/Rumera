import { notFound, redirect } from "next/navigation";

import { InventoryVariantView } from "@/features/admin/inventory/components/inventory-variant-view";
import { inventoryMovementPageHref } from "@/features/admin/inventory/components/inventory-movement-history";
import {
  getVariantInventory,
  listInventoryMovements,
} from "@/features/inventory/api";
import { isApiNotFoundError } from "@/lib/api/error-semantics";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const MOVEMENTS_PER_PAGE = 12;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

export default async function AdminInventoryVariantPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantID: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { variantID: rawVariantID } = await params;
  if (!/^[1-9]\d*$/.test(rawVariantID)) notFound();
  const variantID = Number(rawVariantID);
  if (!Number.isSafeInteger(variantID)) notFound();

  const session = await requirePermission(PERMISSIONS.INVENTORY_READ);
  const movementPage = parsePage((await searchParams).movement_page);

  let inventory;
  try {
    inventory = await getVariantInventory(variantID);
  } catch (error) {
    if (isApiNotFoundError(error)) notFound();
    throw error;
  }

  const movements = await listInventoryMovements({
    product_variant_id: variantID,
    page: movementPage,
    limit: MOVEMENTS_PER_PAGE,
    sortBy: "created_at",
    orderBy: "desc",
  });
  if (movementPage > Math.max(1, movements.pagination.total_pages)) {
    redirect(
      inventoryMovementPageHref(variantID, movements.pagination.total_pages),
    );
  }

  return (
    <InventoryVariantView
      inventory={inventory}
      movements={movements.results}
      movementPagination={movements.pagination}
      canWrite={can(session, PERMISSIONS.INVENTORY_WRITE)}
    />
  );
}
