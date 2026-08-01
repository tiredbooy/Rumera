"use client";

import Link from "next/link";
import { History } from "lucide-react";

import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/analytics/components/DataTable";
import { InventoryStockBadge } from "@/features/inventory/components/inventory-stock-badge";
import type {
  InventoryItem,
  InventoryStatus,
} from "@/features/inventory/types";
import { getInventoryStatus } from "@/features/inventory/utils";

import { StockAdjustmentPopover } from "./stock-adjustment-popover";

type InventoryTableRow = InventoryItem & { status: InventoryStatus };

function InventoryActions({
  canWrite,
  row,
}: {
  canWrite: boolean;
  row: InventoryTableRow;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="size-11" asChild>
        <Link
          href={`/admin/inventory/${row.product_variant_id}`}
          aria-label={`مشاهدهٔ گردش موجودی ${row.product_title}`}
        >
          <History className="size-4" aria-hidden />
        </Link>
      </Button>
      {canWrite ? <StockAdjustmentPopover inventory={row} compact /> : null}
    </div>
  );
}

function ReorderValues({ row }: { row: InventoryTableRow }) {
  return (
    <div className="leading-tight">
      <p className="tabular-nums">آستانه {faNum(row.reorder_point)}</p>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        پیشنهاد {faNum(row.reorder_quantity)}
      </p>
    </div>
  );
}

export function InventoryTable({
  canWrite,
  inventory,
}: {
  canWrite: boolean;
  inventory: InventoryItem[];
}) {
  const rows: InventoryTableRow[] = inventory.map((row) => ({
    ...row,
    status: getInventoryStatus(row),
  }));
  const categories = Array.from(
    new Set(
      rows
        .map((row) => row.category_title)
        .filter((category): category is string => Boolean(category)),
    ),
  );

  const columns: Column<InventoryTableRow>[] = [
    {
      id: "name",
      header: "محصول",
      sortValue: (r) => r.product_title,
      cell: (r) => (
        <div className="min-w-36 leading-tight">
          <p className="font-medium">{r.product_title}</p>
          <p className="text-xs text-muted-foreground">
            {r.category_title ?? "بدون دسته"}
          </p>
        </div>
      ),
    },
    {
      id: "sku",
      header: "کد کالا",
      className: "hidden lg:table-cell",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.sku ?? "—"}
        </span>
      ),
    },
    {
      id: "onHand",
      header: "فیزیکی",
      className: "hidden md:table-cell",
      sortValue: (r) => r.stock_on_hand,
      cell: (r) => (
        <span className="tabular-nums">{faNum(r.stock_on_hand)}</span>
      ),
    },
    {
      id: "reserved",
      header: "رزرو",
      className: "hidden xl:table-cell",
      sortValue: (r) => r.committed_stock,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {faNum(r.committed_stock)}
        </span>
      ),
    },
    {
      id: "available",
      header: "قابل فروش",
      sortValue: (r) => r.available_stock,
      cell: (r) => (
        <div className="space-y-1.5">
          <span className="font-medium tabular-nums">
            {faNum(r.available_stock)}
          </span>
          <span className="block sm:hidden">
            <InventoryStockBadge status={r.status} />
          </span>
        </div>
      ),
    },
    {
      id: "reorder",
      header: "تأمین",
      className: "hidden lg:table-cell",
      sortValue: (r) => r.reorder_point,
      cell: (r) => <ReorderValues row={r} />,
    },
    {
      id: "status",
      header: "وضعیت",
      className: "hidden sm:table-cell",
      sortValue: (r) => r.available_stock,
      cell: (r) => <InventoryStockBadge status={r.status} />,
    },
    {
      id: "actions",
      header: "عملیات",
      align: "end",
      cell: (r) => <InventoryActions canWrite={canWrite} row={r} />,
    },
  ];

  const filters: Filter<InventoryTableRow>[] = [
    {
      id: "category",
      label: "دسته",
      getValue: (r) => r.category_title ?? "",
      options: categories.map((category) => ({
        value: category,
        label: category,
      })),
    },
    {
      id: "status",
      label: "وضعیت",
      getValue: (r) => r.status,
      options: [
        { value: "in_stock", label: "موجود" },
        { value: "low", label: "رو به اتمام" },
        { value: "out", label: "ناموجود" },
      ],
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(r) => String(r.id)}
      rowHref={(r) => `/admin/inventory/${r.product_variant_id}`}
      searchText={(r) =>
        `${r.product_title} ${r.category_title ?? ""} ${r.sku ?? ""}`
      }
      searchPlaceholder="جستجوی محصول یا کد کالا…"
      filters={filters}
      pageSize={10}
      emptyMessage="رکورد موجودی مطابق این جستجو پیدا نشد."
    />
  );
}
