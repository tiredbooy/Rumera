"use client"

import { formatPrice, faNum } from "@/lib/products"
import { adminOrders, type AdminOrder } from "@/lib/admin/data"
import { PaymentBadge, FulfilmentBadge } from "@/components/admin/status-badge"
import { DataTable, type Column, type Filter } from "@/components/admin/data-table"

export function OrdersTable() {
  const columns: Column<AdminOrder>[] = [
    {
      id: "number",
      header: "شماره",
      sortValue: (o) => o.number,
      cell: (o) => <span className="font-medium">#{faNum(o.number)}</span>,
    },
    {
      id: "customer",
      header: "مشتری",
      sortValue: (o) => o.customerName,
      cell: (o) => (
        <div className="leading-tight">
          <p className="font-medium">{o.customerName}</p>
          <p className="text-xs text-muted-foreground">{o.city}</p>
        </div>
      ),
    },
    { id: "date", header: "تاریخ", sortValue: (o) => o.date, cell: (o) => <span className="text-muted-foreground" dir="ltr">{o.date}</span> },
    { id: "items", header: "اقلام", sortValue: (o) => o.itemsCount, cell: (o) => <span className="tabular-nums text-muted-foreground">{faNum(o.itemsCount)}</span> },
    { id: "total", header: "مبلغ", sortValue: (o) => o.total, cell: (o) => <span className="font-medium">{formatPrice(o.total)}</span> },
    { id: "payment", header: "پرداخت", sortValue: (o) => o.payment, cell: (o) => <PaymentBadge status={o.payment} /> },
    { id: "fulfilment", header: "ارسال", sortValue: (o) => o.fulfilment, cell: (o) => <FulfilmentBadge status={o.fulfilment} /> },
  ]

  const filters: Filter<AdminOrder>[] = [
    {
      id: "payment",
      label: "پرداخت",
      getValue: (o) => o.payment,
      options: [
        { value: "paid", label: "پرداخت‌شده" },
        { value: "pending", label: "در انتظار" },
        { value: "refunded", label: "بازپرداخت" },
        { value: "failed", label: "ناموفق" },
      ],
    },
    {
      id: "fulfilment",
      label: "ارسال",
      getValue: (o) => o.fulfilment,
      options: [
        { value: "processing", label: "در حال پردازش" },
        { value: "packed", label: "بسته‌بندی" },
        { value: "shipped", label: "ارسال‌شده" },
        { value: "delivered", label: "تحویل‌شده" },
        { value: "cancelled", label: "لغوشده" },
      ],
    },
  ]

  return (
    <DataTable
      rows={adminOrders}
      columns={columns}
      getRowKey={(o) => o.id}
      searchText={(o) => `${o.number} ${o.customerName} ${o.city}`}
      searchPlaceholder="جستجوی شماره یا مشتری…"
      filters={filters}
      rowHref={(o) => `/admin/orders/${o.id}`}
      pageSize={10}
    />
  )
}
