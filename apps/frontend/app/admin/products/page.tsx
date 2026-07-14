import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { fetchAdminProducts } from "@/features/admin/products/api/server";
import { ProductsTable } from "@/features/admin/products/components/ProductsTable";

export default async function AdminProductsPage() {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const canWrite = can(session, PERMISSIONS.PRODUCTS_WRITE);
  const products = await fetchAdminProducts({
    limit: 100,
    sortBy: "created_at",
    orderBy: "desc",
  });

  return (
    <>
      <PageHeader
        title="محصولات"
        description="محصولات فعال و پیش‌نویس کاتالوگ را مدیریت کنید."
        actions={
          canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/products/new">
                <Plus className="size-4" /> محصول جدید
              </Link>
            </Button>
          ) : null
        }
      />
      <ProductsTable products={products.results} canWrite={canWrite} />
    </>
  );
}
