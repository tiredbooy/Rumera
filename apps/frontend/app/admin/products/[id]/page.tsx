import { ProductEditView } from "@/features/admin/products/components/product-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id } = await params;
  return (
    <ProductEditView
      id={id}
      canWrite={can(session, PERMISSIONS.PRODUCTS_WRITE)}
      canAdjustStock={can(session, PERMISSIONS.INVENTORY_WRITE)}
    />
  );
}
