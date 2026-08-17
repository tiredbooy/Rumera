import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  PackageX,
  Scale,
  Wallet,
} from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { listInventory } from "@/features/inventory/api";
import type { InventoryListQuery } from "@/features/inventory/types";
import { ApiError } from "@/lib/api/errors";
import { formatPrice, faNum } from "@/lib/products";
import type { Pagination } from "@/lib/api/types";

import {
  ADMIN_INVENTORY_PAGE_SIZE,
  hasAdminInventoryListFilters,
  inventoryPageHref,
  parseAdminInventoryListParams,
  type AdminInventoryListFilters,
  type InventorySearchParams,
} from "../inventory-list-params";
import { InventoryListFilters } from "./inventory-list-filters";
import { InventoryTable } from "./InventoryTable";

export type { InventorySearchParams };

const LIST_SORT = {
  sortBy: "updated_at",
  orderBy: "desc",
} as const satisfies Pick<InventoryListQuery, "sortBy" | "orderBy">;

function listQuery(
  filters: AdminInventoryListFilters,
): InventoryListQuery {
  return {
    page: filters.page,
    limit: ADMIN_INVENTORY_PAGE_SIZE,
    search: filters.query || undefined,
    low_stock: filters.lowStock || undefined,
    ...LIST_SORT,
  };
}

export function InventoryListView({
  searchParams,
  canWrite,
}: {
  searchParams: InventorySearchParams;
  canWrite: boolean;
}) {
  const filters = parseAdminInventoryListParams(searchParams);

  return (
    <AdminPage
      title="موجودی"
      description={
        canWrite
          ? "از آیکون تنظیم روی هر ردیف، موجودی را تغییر دهید. کارت‌های ناموجود، وزن ناقص و ارزش، و فیلتر جدول، فقط همین صفحه را می‌شمارند."
          : "پایش موجودی انبار. شمارش ناموجود، وزن ناقص و ارزش مربوط به همین صفحه است."
      }
      filters={<InventoryListFilters filters={filters} />}
    >
      <InventoryListResults filters={filters} canWrite={canWrite} />
    </AdminPage>
  );
}

export async function InventoryListResults({
  filters,
  canWrite,
}: {
  filters: AdminInventoryListFilters;
  canWrite: boolean;
}) {
  const hasFilters = hasAdminInventoryListFilters(filters);
  let list;
  let catalogMeta;
  let lowMeta;
  try {
    [list, catalogMeta, lowMeta] = await Promise.all([
      listInventory(listQuery(filters)),
      hasFilters
        ? listInventory({ page: 1, limit: 1, ...LIST_SORT })
        : Promise.resolve(null),
      filters.lowStock
        ? Promise.resolve(null)
        : listInventory({ page: 1, limit: 1, low_stock: true, ...LIST_SORT }),
    ]);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <AdminDataErrorState
        title="دریافت موجودی ناموفق بود"
        description="هیچ فهرست جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
      />
    );
  }

  if (filters.page > Math.max(1, list.pagination.total_pages)) {
    redirect(
      inventoryPageHref(filters, Math.max(1, list.pagination.total_pages)),
    );
  }

  const skuCount =
    catalogMeta?.pagination.total_items ?? list.pagination.total_items;
  const lowStockCount = filters.lowStock
    ? list.pagination.total_items
    : (lowMeta?.pagination.total_items ?? 0);
  const pageStats = {
    outOfStock: list.results.filter((row) => row.available_stock <= 0).length,
    missingWeight: list.results.filter((row) => row.missing_weight).length,
    stockValue: list.results.reduce(
      (total, row) => total + row.stock_on_hand * Number(row.unit_price),
      0,
    ),
  };

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="تعداد کالا"
          value={faNum(skuCount)}
          icon={Boxes}
          hint={hasFilters ? "مطابق فیلتر سرور" : "کل انبار"}
        />
        <StatCard
          label="ناموجود"
          value={faNum(pageStats.outOfStock)}
          icon={PackageX}
          hint="در این صفحه"
        />
        <StatCard
          label="رو به اتمام"
          value={faNum(lowStockCount)}
          icon={AlertTriangle}
          hint={
            filters.lowStock ? "مطابق فیلتر سرور" : "کل انبار · ≤ آستانه"
          }
        />
        <StatCard
          label="وزن ناقص"
          value={faNum(pageStats.missingWeight)}
          icon={Scale}
          hint="در این صفحه"
        />
        <StatCard
          label="ارزش موجودی"
          value={formatPrice(pageStats.stockValue)}
          icon={Wallet}
          hint="در این صفحه"
        />
      </div>

      {list.results.length === 0 ? (
        <InventoryListEmpty hasFilters={hasFilters} />
      ) : (
        <>
          <InventoryTable canWrite={canWrite} inventory={list.results} />
          <InventoryListPagination
            filters={filters}
            pagination={list.pagination}
          />
        </>
      )}
    </>
  );
}

function InventoryListEmpty({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="border-hairline flex flex-col items-center rounded-2xl bg-card/50 px-6 py-14 text-center ring-1 ring-foreground/[0.04]">
      <p className="font-serif text-lg">
        {hasFilters
          ? "رکورد موجودی مطابق این جستجو پیدا نشد"
          : "هنوز ردیف موجودی ندارید"}
      </p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {hasFilters ? (
          "عبارت جستجو یا فیلتر کسری را تغییر دهید. جستجو روی کل انبار اعمال می‌شود، نه فقط این صفحه."
        ) : (
          <>
            با ساخت محصول و واریانت، ردیف موجودی خودکار ساخته می‌شود. از پنل
            محصولات یک کالا اضافه کنید.
          </>
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {hasFilters ? (
          <Button asChild variant="outline" className="h-11">
            <Link href="/admin/inventory">پاک کردن فیلترها</Link>
          </Button>
        ) : (
          <>
            <Button asChild className="h-11">
              <Link href="/admin/products">رفتن به محصولات</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/admin/products/new">افزودن محصول</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function InventoryListPagination({
  filters,
  pagination,
}: {
  filters: AdminInventoryListFilters;
  pagination: Pagination;
}) {
  return (
    <ListPagination
      page={pagination.page}
      totalPages={pagination.total_pages}
      hasPrev={pagination.has_prev}
      hasNext={pagination.has_next}
      prevHref={inventoryPageHref(filters, pagination.page - 1)}
      nextHref={inventoryPageHref(filters, pagination.page + 1)}
      ariaLabel="صفحه‌بندی موجودی"
      className="mt-6"
      label={
        <>
          {faNum(pagination.total_items)}{" "}
          {hasAdminInventoryListFilters(filters)
            ? "ردیف مطابق فیلتر سرور"
            : "ردیف در کل انبار"}{" "}
          · صفحهٔ {faNum(pagination.page)} از {faNum(pagination.total_pages)}
        </>
      }
    />
  );
}
