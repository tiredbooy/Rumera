"use client";

import * as React from "react";
import Link from "next/link";
import { History, Scale } from "lucide-react";

import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/analytics/components/DataTable";
import { useRowSelection } from "@/features/dashboard/components/use-row-selection";
import { InventoryStockBadge } from "@/features/inventory/components/inventory-stock-badge";
import type {
  InventoryItem,
  InventoryStatus,
} from "@/features/inventory/types";
import { getInventoryStatus } from "@/features/inventory/utils";
import { cn } from "@/lib/utils";

import { BulkStockAdjustment } from "./bulk-stock-adjustment";
import { StockAdjustmentPopover } from "./stock-adjustment-popover";

type InventoryTableRow = InventoryItem & { status: InventoryStatus };

function selectionKey(row: InventoryTableRow): string {
  return String(row.product_variant_id);
}

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
  // DataTable owns the facet state. Select-all and the bar must follow the
  // rows it is actually showing — ticking a hidden row is how an operator
  // adjusts stock they cannot see.
  const [visibleKeys, setVisibleKeys] = React.useState<string[] | null>(null);
  const visibleRows = React.useMemo(() => {
    if (visibleKeys === null) return rows;
    const allowed = new Set(visibleKeys);
    return rows.filter((row) => allowed.has(selectionKey(row)));
  }, [rows, visibleKeys]);
  const handleVisibleRows = React.useCallback((visible: InventoryTableRow[]) => {
    const keys = visible.map(selectionKey);
    setVisibleKeys((current) => {
      if (
        current &&
        current.length === keys.length &&
        current.every((key, index) => key === keys[index])
      ) {
        return current;
      }
      return keys;
    });
  }, []);
  // Keyed by variant id — the id the adjust endpoint takes, so nothing has to
  // translate between "the row I ticked" and "the ledger row I moved".
  const selection = useRowSelection(visibleRows, selectionKey);
  const facetActive = visibleRows.length !== rows.length;
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
        // The row itself is not a link: a full-row link and a selection
        // checkbox cannot share a row without nesting one inside the other.
        <Link
          href={`/admin/inventory/${r.product_variant_id}`}
          className="-m-1 flex min-h-11 min-w-36 flex-col justify-center rounded-md p-1 leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-medium">{r.product_title}</span>
          <span className="text-xs text-muted-foreground">
            {r.category_title ?? "بدون دسته"}
          </span>
        </Link>
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
      id: "weight",
      header: "وزن",
      className: "hidden md:table-cell",
      sortValue: (r) => (r.missing_weight ? -1 : (r.weight ?? 0)),
      cell: (r) =>
        r.missing_weight ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5",
              "text-xs font-medium text-warning",
            )}
            title="وزن بسته‌بندی روی محصول ثبت نشده — برای محاسبهٔ ارسال لازم است"
          >
            <Scale className="size-3.5 shrink-0" aria-hidden />
            وزن ناقص
          </span>
        ) : (
          <span className="tabular-nums text-muted-foreground" dir="ltr">
            {faNum(r.weight ?? 0)} kg
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

  if (canWrite) {
    columns.unshift({
      id: "select",
      header: "انتخاب",
      cell: (r) => (
        <Checkbox
          checked={selection.isSelected(selectionKey(r))}
          aria-label={`انتخاب ${r.product_title}`}
          onCheckedChange={(checked) =>
            selection.toggle(selectionKey(r), checked === true)
          }
        />
      ),
    });
  }

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
        { value: "low", label: "رو به اتمام (≤ آستانه)" },
        { value: "out", label: "ناموجود" },
      ],
    },
    {
      id: "critical",
      label: "موجودی بحرانی",
      getValue: (r) =>
        r.available_stock > 0 && r.available_stock < 3 ? "critical" : "ok",
      options: [
        { value: "critical", label: "کمتر از ۳ عدد" },
        { value: "ok", label: "۳ و بیشتر یا صفر" },
      ],
    },
    {
      id: "missing_weight",
      label: "وزن بسته‌بندی",
      getValue: (r) => (r.missing_weight ? "missing" : "ok"),
      options: [
        { value: "missing", label: "وزن ناقص (نیازمند اصلاح)" },
        { value: "ok", label: "وزن ثبت‌شده" },
      ],
    },
  ];

  if (rows.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center rounded-2xl bg-card/50 px-6 py-14 text-center ring-1 ring-foreground/[0.04]">
        <p className="font-serif text-lg">هنوز ردیف موجودی ندارید</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          با ساخت محصول و واریانت، ردیف موجودی خودکار ساخته می‌شود. از پنل
          محصولات یک کالا اضافه کنید.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild className="h-11">
            <Link href="/admin/products">رفتن به محصولات</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/admin/products/new">افزودن محصول</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {canWrite ? (
        <BulkStockAdjustment
          pageRowCount={rows.length}
          visibleRowCount={visibleRows.length}
          facetActive={facetActive}
          selected={selection.selectedRows}
          allSelected={selection.allSelected}
          onToggleAll={selection.toggleAll}
          onKeepOnly={(variantIDs) =>
            selection.keepOnly(variantIDs.map(String))
          }
        />
      ) : null}
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(r) => String(r.id)}
        filters={filters}
        pageSize={Math.max(rows.length, 1)}
        onVisibleRowsChange={handleVisibleRows}
        toolbarHint="فیلتر جدول فقط روی ردیف‌های همین صفحه است، نه کل انبار."
        resultCountLabel={(filtered, total) =>
          `${faNum(filtered)} از ${faNum(total)} ردیف این صفحه`
        }
        emptyMessage="در این صفحه رکوردی مطابق فیلتر جدول پیدا نشد. فیلتر را پاک کنید یا صفحه را عوض کنید."
      />
    </>
  );
}
