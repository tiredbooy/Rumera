"use client";

import * as React from "react";

import { formatPrice, faNum } from "@/lib/products";
import { ORDER_STATUS_FA, PAYMENT_FA, faDate } from "@/lib/catalog/labels";
import type { OrderListItem, OrderStatus } from "@/lib/catalog/types";
import { listOrders } from "@/lib/api/admin-client";
import { adminOrders, type FulfilmentStatus } from "@/lib/admin/data";
import { OrderStatusBadge } from "@/components/admin/status-badge";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/analytics/components/DataTable";

// Curated fallback (mapped from the sample set into the live shape) so the table
// is never empty when the backend is unreachable. The list endpoint exposes no
// customer/address and item_count is not yet computed, so those columns are gone.
const FULFIL_TO_STATUS: Record<FulfilmentStatus, OrderStatus> = {
  processing: "processing",
  packed: "ready_to_ship",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

const FALLBACK_ORDERS: OrderListItem[] = adminOrders.map((o) => ({
  id: o.number,
  status: FULFIL_TO_STATUS[o.fulfilment],
  payment_method: "gateway",
  total_amount: o.total,
  item_count: o.itemsCount,
  created_at: o.date,
}));

const STATUS_FILTER_OPTIONS = (
  Object.keys(ORDER_STATUS_FA) as OrderStatus[]
).map((s) => ({
  value: s,
  label: ORDER_STATUS_FA[s],
}));

export function OrdersTable() {
  const [rows, setRows] = React.useState<OrderListItem[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listOrders({ limit: 50, sortBy: "created_at", orderBy: "desc" })
      .then((page) => {
        if (!cancelled) setRows(page?.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setRows(null); // keep the sample fallback
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Empty live result still shows the empty state; only a failed fetch falls back.
  const data = rows ?? FALLBACK_ORDERS;

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

  return (
    <DataTable
      rows={data}
      columns={columns}
      getRowKey={(o) => String(o.id)}
      searchText={(o) => `${o.id}`}
      searchPlaceholder="جستجوی شمارهٔ سفارش…"
      filters={filters}
      rowHref={(o) => `/admin/orders/${o.id}`}
      pageSize={10}
    />
  );
}
