import {
  ProductsListView,
  type ProductsSearchParams,
} from "@/features/admin/products/components/products-list-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const canWrite = can(session, PERMISSIONS.PRODUCTS_WRITE);
  const resolvedSearchParams = await searchParams;
  return (
    <ProductsListView
      searchParams={resolvedSearchParams}
      canWrite={canWrite}
    />
  );
}
