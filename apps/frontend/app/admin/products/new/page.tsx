import { ProductCreateView } from "@/features/admin/products/components/product-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminNewProductPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  return <ProductCreateView />;
}
