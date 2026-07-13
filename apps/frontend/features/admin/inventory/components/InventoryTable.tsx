"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { faNum } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/analytics/components/DataTable";
import { InventoryStockBadge } from "@/features/inventory/components/inventory-stock-badge";
import { useAdjustVariantStock } from "@/features/inventory/hooks";
import type {
  InventoryItem,
  InventoryStatus,
} from "@/features/inventory/types";
import { getInventoryStatus } from "@/features/inventory/utils";

type InventoryTableRow = InventoryItem & { status: InventoryStatus };

function AdjustPopover({ row }: { row: InventoryTableRow }) {
  const router = useRouter();
  const adjustment = useAdjustVariantStock();
  const [qty, setQty] = React.useState(row.stock_on_hand);
  const [open, setOpen] = React.useState(false);

  async function save() {
    const delta = qty - row.stock_on_hand;
    if (delta === 0) {
      setOpen(false);
      return;
    }

    try {
      await adjustment.mutateAsync({
        variantID: row.product_variant_id,
        input: {
          quantity: delta,
          type: "adjustment",
          note: "Admin inventory adjustment",
        },
      });
      toast.success(
        `موجودی «${row.product_title}» روی ${faNum(qty)} تنظیم شد`,
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("ذخیرهٔ موجودی انجام نشد. دوباره تلاش کنید.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="تنظیم موجودی">
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm font-medium">{row.product_title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
          {row.sku ?? `#${row.product_variant_id}`}
        </p>
        <Label
          htmlFor={`stock-${row.product_variant_id}`}
          className="mt-4 block text-xs"
        >
          موجودی انبار
        </Label>
        <div className="mt-1.5 flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setQty((q) => Math.max(0, q - 1))}
            aria-label="کاهش"
          >
            <Minus className="size-4" />
          </Button>
          <Input
            id={`stock-${row.product_variant_id}`}
            type="number"
            dir="ltr"
            className="text-center"
            value={qty}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setQty((q) => q + 1)}
            aria-label="افزایش"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <Button
          className="mt-3 w-full"
          size="sm"
          disabled={adjustment.isPending}
          onClick={save}
        >
          {adjustment.isPending ? "در حال ذخیره…" : "ذخیرهٔ موجودی"}
        </Button>
      </PopoverContent>
    </Popover>
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
    new Set(rows.flatMap((row) => row.category_title ?? [])),
  );

  const columns: Column<InventoryTableRow>[] = [
    {
      id: "name",
      header: "محصول",
      sortValue: (r) => r.product_title,
      cell: (r) => (
        <div className="leading-tight">
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
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.sku ?? "—"}
        </span>
      ),
    },
    {
      id: "onHand",
      header: "موجود",
      sortValue: (r) => r.stock_on_hand,
      cell: (r) => (
        <span className="tabular-nums">{faNum(r.stock_on_hand)}</span>
      ),
    },
    {
      id: "reserved",
      header: "رزرو",
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
        <span className="font-medium tabular-nums">
          {faNum(r.available_stock)}
        </span>
      ),
    },
    {
      id: "status",
      header: "وضعیت",
      sortValue: (r) => r.available_stock,
      cell: (r) => <InventoryStockBadge status={r.status} />,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: "",
            align: "end",
            cell: (r: InventoryTableRow) => <AdjustPopover row={r} />,
          } as Column<InventoryTableRow>,
        ]
      : []),
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
      searchText={(r) => `${r.product_title} ${r.sku ?? ""}`}
      searchPlaceholder="جستجوی محصول یا کد کالا…"
      filters={filters}
      pageSize={10}
    />
  );
}
