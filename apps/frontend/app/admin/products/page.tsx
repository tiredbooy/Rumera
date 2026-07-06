import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { faNum } from "@/lib/products";
import { serverApi } from "@/lib/api/client";
import type { Paginated, ProductListItem } from "@/lib/catalog/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ProductsTable } from "@/features/admin/products/components/products-table";

const EMPTY: Paginated<ProductListItem> = {
  results: [],
  pagination: {
    page: 1,
    limit: 0,
    total_items: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
};

export default async function AdminProductsPage() {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const canWrite = can(session, PERMISSIONS.PRODUCTS_WRITE);

  // GET /admin/products returns ALL products (incl. inactive) with brand + price
  // band. Error-safe: a failed fetch renders an empty table rather than crashing.
  let page: Paginated<ProductListItem>;
  try {
    page = await serverApi<Paginated<ProductListItem>>(
      "/admin/products?limit=100&sortBy=created_at&orderBy=desc",
    );
  } catch {
    page = EMPTY;
  }

  return (
    <>
      <PageHeader
        title="محصولات"
        description={`${faNum(page.pagination.total_items)} محصول در کاتالوگ`}
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

      <ProductsTable products={page.results} canWrite={canWrite} />
    </>
  );
}
