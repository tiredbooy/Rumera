import "server-only";

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { fetchAdminProducts } from "@/features/admin/products/api/server";
import { ProductsFilters } from "@/features/admin/products/components/products-list-filters";
import { ProductsTable } from "@/features/admin/products/components/ProductsTable";
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  hasAdminProductListFilters,
  parseAdminProductListParams,
  productsPageHref,
  type AdminProductListFilters,
  type ProductsSearchParams,
} from "@/features/admin/products/products-list-params";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { ApiError } from "@/lib/api/errors";
import { faNum } from "@/lib/products";

export type { ProductsSearchParams };

export function ProductsListView({
  searchParams,
  canWrite,
}: {
  searchParams: ProductsSearchParams;
  canWrite: boolean;
}) {
  const filters = parseAdminProductListParams(searchParams);

  return (
    <AdminPage
      title="محصولات"
      description="محصولات فعال و پیش‌نویس کاتالوگ را مدیریت کنید."
      action={
        canWrite ? (
          <Button size="sm" asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" /> محصول جدید
            </Link>
          </Button>
        ) : null
      }
      filters={<ProductsFilters filters={filters} />}
    >
      <Suspense
        key={`${filters.query}|${filters.isActive ?? "all"}|${filters.sortBy}:${filters.orderBy}|${filters.page}`}
        fallback={<ProductsListSkeleton />}
      >
        <ProductsListResults filters={filters} canWrite={canWrite} />
      </Suspense>
    </AdminPage>
  );
}

export function ProductsListSkeleton() {
  return (
    <div
      className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
      aria-hidden
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/40 px-4 py-4 last:border-0"
        >
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 max-w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden h-5 w-20 animate-pulse rounded bg-muted sm:block" />
          <div className="hidden h-5 w-16 animate-pulse rounded-full bg-muted md:block" />
        </div>
      ))}
    </div>
  );
}

export async function ProductsListResults({
  filters,
  canWrite,
}: {
  filters: AdminProductListFilters;
  canWrite: boolean;
}) {
  let data;
  try {
    data = await fetchAdminProducts({
      page: filters.page,
      limit: ADMIN_PRODUCTS_PAGE_SIZE,
      search: filters.query || undefined,
      is_active: filters.isActive,
      sortBy: filters.sortBy,
      orderBy: filters.orderBy,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <AdminDataErrorState
        title="دریافت محصولات ناموفق بود"
        description="هیچ فهرست جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
      />
    );
  }

  const { results, pagination } = data;
  if (filters.page > pagination.total_pages) {
    redirect(productsPageHref(filters, pagination.total_pages));
  }

  const hasFilters = hasAdminProductListFilters(filters);

  if (results.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Package className="size-6" />
        </span>
        <p className="font-serif text-lg">
          {hasFilters
            ? "محصولی با این فیلترها یافت نشد"
            : "هنوز محصولی ثبت نشده است"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "عبارت جستجو، وضعیت یا مرتب‌سازی را تغییر دهید. جستجو روی کل کاتالوگ اعمال می‌شود، نه فقط این صفحه."
            : "پس از ساخت نخستین محصول، عنوان، قیمت و وضعیت آن در این فهرست نمایش داده می‌شود."}
        </p>
        {hasFilters ? (
          <Button
            variant="outline"
            size="lg"
            asChild
            className="mt-1 cursor-pointer"
          >
            <Link href="/admin/products">پاک کردن فیلترها</Link>
          </Button>
        ) : canWrite ? (
          <Button size="lg" asChild className="mt-1 cursor-pointer">
            <Link href="/admin/products/new">ساخت نخستین محصول</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <ProductsTable products={results} canWrite={canWrite} />
      <ListPagination
        page={pagination.page}
        totalPages={pagination.total_pages}
        hasPrev={pagination.has_prev}
        hasNext={pagination.has_next}
        prevHref={productsPageHref(filters, pagination.page - 1)}
        nextHref={productsPageHref(filters, pagination.page + 1)}
        ariaLabel="صفحه‌بندی محصولات"
        className="mt-4"
        label={
          <>
            {faNum(pagination.total_items)} محصول · صفحهٔ{" "}
            {faNum(pagination.page)} از {faNum(pagination.total_pages)}
          </>
        }
      />
    </>
  );
}
