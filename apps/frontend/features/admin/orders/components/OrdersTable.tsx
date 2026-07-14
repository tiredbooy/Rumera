"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { formatPrice, faNum } from "@/lib/products";
import { ORDER_STATUS_FA, PAYMENT_FA } from "@/features/orders/labels";
import type { OrderListItem, OrderStatus } from "@/features/orders/types";
import { useAdminOrders } from "@/features/admin/orders/hooks";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { faDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/analytics/components/DataTable";

const PAGE_SIZE = 50;

const STATUS_FILTER_OPTIONS = (
  Object.keys(ORDER_STATUS_FA) as OrderStatus[]
).map((s) => ({
  value: s,
  label: ORDER_STATUS_FA[s],
}));

export function OrdersTable() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, isFetching, refetch } = useAdminOrders({
    page,
    limit: PAGE_SIZE,
    sortBy: "created_at",
    orderBy: "desc",
  });
  const rows = data?.results ?? [];

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

  const filters: Filter<OrderListItem>[] = [
    {
      id: "status",
      label: "وضعیت",
      getValue: (o) => o.status,
      options: STATUS_FILTER_OPTIONS,
    },
  ];

  if (isLoading) {
    return (
      <div
        className="border-hairline flex min-h-64 items-center justify-center rounded-2xl bg-card text-muted-foreground"
        role="status"
      >
        <Loader2 className="me-2 size-5 animate-spin" aria-hidden />
        در حال دریافت سفارش‌ها…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="border-hairline flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-card text-center"
        role="alert"
      >
        <p className="text-sm text-destructive">خطا در دریافت سفارش‌ها.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          تلاش دوباره
        </Button>
      </div>
    );
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-4" aria-busy={isFetching}>
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(o) => String(o.id)}
        searchText={(o) => `${o.id}`}
        searchPlaceholder="جستجوی شمارهٔ سفارش…"
        filters={filters}
        rowHref={(o) => `/admin/orders/${o.id}`}
        pageSize={PAGE_SIZE}
      />
      {pagination && pagination.total_pages > 1 ? (
        <nav
          className="flex items-center justify-center gap-2"
          aria-label="صفحه‌بندی سفارش‌ها"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.has_prev || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronRight className="size-4" aria-hidden /> قبلی
          </Button>
          <span className="px-2 text-sm text-muted-foreground" aria-live="polite">
            صفحهٔ {faNum(pagination.page)} از {faNum(pagination.total_pages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.has_next || isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            بعدی <ChevronLeft className="size-4" aria-hidden />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
