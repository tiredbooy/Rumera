"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";

import { formatPrice, faNum } from "@/lib/products";
import { PAYMENT_FA } from "@/features/orders/labels";
import type { OrderListBuyer, OrderListItem } from "@/features/orders/types";
import { adminCustomerHref } from "@/features/admin/payments/customer-href";
import { useAdminOrders } from "@/features/admin/orders/hooks";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { faDate } from "@/lib/utils/date";
import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type Column,
} from "@/features/admin/analytics/components/DataTable";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { DashboardErrorState } from "@/features/dashboard/components/async-state";

import {
  ADMIN_ORDERS_PAGE_SIZE,
  adminOrdersHref,
  hasAdminOrderListFilters,
  toAdminOrderListQuery,
  type AdminOrderListFilters,
} from "../order-list-params";
import { OrderListFilters } from "./order-list-filters";

/** Name if we have one, else email, else the em dash. Both names are nullable. */
function buyerLabel(buyer?: OrderListBuyer): string {
  const name = [buyer?.first_name, buyer?.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return name || buyer?.email?.trim() || "";
}

function BuyerCell({ buyer }: { buyer?: OrderListBuyer }) {
  const label = buyerLabel(buyer);
  if (!label) return <span className="text-muted-foreground">—</span>;

  // adminCustomerHref returns undefined for anything that is not the public
  // UUID, so a row can never link to a fabricated customer page.
  const href = adminCustomerHref(buyer?.user_id);
  const name = (
    <span className="block max-w-[16ch] truncate">{label}</span>
  );

  return (
    <span className="block min-w-0">
      {href ? (
        <Link
          href={href}
          className="font-medium underline-offset-4 hover:underline"
          data-testid="order-buyer-link"
        >
          {name}
        </Link>
      ) : (
        <span className="font-medium">{name}</span>
      )}
      {buyer?.phone ? (
        <span className="block text-xs text-muted-foreground" dir="ltr">
          {buyer.phone}
        </span>
      ) : null}
    </span>
  );
}

export function OrdersTable({
  filters,
}: {
  filters: AdminOrderListFilters;
}) {
  const query = toAdminOrderListQuery(filters);
  const { data, isLoading, isError, isFetching, refetch } =
    useAdminOrders(query);
  const rows = data?.results ?? [];
  const hasFilters = hasAdminOrderListFilters(filters);

  const columns: Column<OrderListItem>[] = [
    {
      id: "number",
      header: "شماره",
      sortValue: (o) => o.id,
      cell: (o) => (
        <span className="font-medium" dir="ltr">
          #{faNum(o.id)}
        </span>
      ),
    },
    // CF-1. Without this, triaging a morning meant opening every order to learn
    // who placed it. DataTable only wraps the FIRST column in the row link, so a
    // nested anchor here is safe.
    {
      id: "buyer",
      header: "خریدار",
      sortValue: (o) => buyerLabel(o.buyer),
      cell: (o) => <BuyerCell buyer={o.buyer} />,
    },
    {
      id: "date",
      header: "تاریخ",
      sortValue: (o) => o.created_at,
      cell: (o) => (
        <span className="text-muted-foreground" dir="ltr">
          {faDate(o.created_at)}
        </span>
      ),
    },
    {
      id: "total",
      header: "مبلغ",
      sortValue: (o) => o.total_amount,
      cell: (o) => (
        <span className="font-medium">{formatPrice(o.total_amount)}</span>
      ),
    },
    {
      id: "payment",
      header: "روش پرداخت",
      sortValue: (o) => o.payment_method,
      cell: (o) => (
        <span className="text-muted-foreground">
          {PAYMENT_FA[o.payment_method]}
        </span>
      ),
    },
    {
      id: "status",
      header: "وضعیت",
      sortValue: (o) => o.status,
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
  ];

  const pagination = data?.pagination;

  return (
    <AdminPage
      title="سفارش‌ها"
      description="مدیریت و پیگیری سفارش‌های فروشگاه. فیلتر وضعیت، تاریخ پرداخت و کاربر روی همهٔ سفارش‌ها اعمال می‌شود، نه فقط ردیف‌های همین صفحه."
      filters={<OrderListFilters filters={filters} />}
      pagination={
        rows.length > 0 && pagination ? (
          <OrdersPager
            page={pagination.page}
            totalPages={pagination.total_pages}
            hasPrev={pagination.has_prev}
            hasNext={pagination.has_next}
            filters={filters}
            disabled={isFetching}
          />
        ) : null
      }
    >
      <div className="space-y-4" aria-busy={isFetching}>
      {isLoading ? (
        <div
          className="border-hairline flex min-h-64 items-center justify-center rounded-2xl bg-card text-muted-foreground"
          role="status"
        >
          <Loader2 className="me-2 size-5 animate-spin" aria-hidden />
          در حال دریافت سفارش‌ها…
        </div>
      ) : isError ? (
        <DashboardErrorState
          title="خطا در دریافت سفارش‌ها"
          description="فهرست سفارش‌ها در دسترس نیست. دوباره تلاش کنید یا بعداً سر بزنید."
          onRetry={() => void refetch()}
          isRetrying={isFetching}
          className="min-h-64"
        />
      ) : rows.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <Inbox className="size-6" />
          </span>
          <p className="font-serif text-lg">
            {hasFilters
              ? "سفارشی با این فیلترها یافت نشد"
              : "هنوز سفارشی ثبت نشده است"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "وضعیت، بازهٔ پرداخت یا شناسهٔ کاربر را تغییر دهید. فیلترها روی کل فهرست اعمال می‌شوند، نه فقط این صفحه."
              : "پس از ثبت نخستین سفارش، شماره، مبلغ و وضعیت آن در این فهرست نمایش داده می‌شود."}
          </p>
          {hasFilters ? (
            <Button
              variant="outline"
              size="lg"
              asChild
              className="mt-1 cursor-pointer"
            >
              <Link href="/admin/orders">پاک کردن فیلترها</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowKey={(o) => String(o.id)}
          rowHref={(o) => `/admin/orders/${o.id}`}
          pageSize={ADMIN_ORDERS_PAGE_SIZE}
          emptyMessage={
            hasFilters
              ? "سفارشی با این فیلترها یافت نشد."
              : "هنوز سفارشی ثبت نشده است."
          }
        />
      )}
      </div>
    </AdminPage>
  );
}

function OrdersPager({
  page,
  totalPages,
  hasPrev,
  hasNext,
  filters,
  disabled,
}: {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  filters: AdminOrderListFilters;
  disabled: boolean;
}) {
  return (
    <ListPagination
      page={page}
      totalPages={totalPages}
      hasPrev={hasPrev}
      hasNext={hasNext}
      prevHref={adminOrdersHref(filters, Math.max(1, page - 1))}
      nextHref={adminOrdersHref(filters, page + 1)}
      disabled={disabled}
      ariaLabel="صفحه‌بندی سفارش‌ها"
    />
  );
}
