"use client"

import * as React from "react"
import { Minus, Plus, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { categories, categoryFa, faNum } from "@/lib/products"
import { inventory, type InventoryRow } from "@/lib/admin/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StockBadge } from "@/components/admin/status-badge"
import { DataTable, type Column, type Filter } from "@/components/admin/data-table"

function AdjustPopover({ row }: { row: InventoryRow }) {
  const [qty, setQty] = React.useState(row.onHand)
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="تنظیم موجودی">
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm font-medium">{row.product.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{row.sku}</p>
        <Label htmlFor={`stock-${row.product.id}`} className="mt-4 block text-xs">
          موجودی انبار
        </Label>
        <div className="mt-1.5 flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setQty((q) => Math.max(0, q - 1))} aria-label="کاهش">
            <Minus className="size-4" />
          </Button>
          <Input
            id={`stock-${row.product.id}`}
            type="number"
            dir="ltr"
            className="text-center"
            value={qty}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
          />
          <Button variant="outline" size="icon" onClick={() => setQty((q) => q + 1)} aria-label="افزایش">
            <Plus className="size-4" />
          </Button>
        </div>
        <Button
          className="mt-3 w-full"
          size="sm"
          onClick={() => {
            toast.success(`موجودی «${row.product.name}» روی ${faNum(qty)} تنظیم شد (نمونه)`)
            setOpen(false)
          }}
        >
          ذخیرهٔ موجودی
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function InventoryTable({ canWrite }: { canWrite: boolean }) {
  const columns: Column<InventoryRow>[] = [
    {
      id: "name",
      header: "محصول",
      sortValue: (r) => r.product.name,
      cell: (r) => (
        <div className="leading-tight">
          <p className="font-medium">{r.product.name}</p>
          <p className="text-xs text-muted-foreground">{categoryFa[r.product.category]}</p>
        </div>
      ),
    },
    {
      id: "sku",
      header: "کد کالا",
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">{r.sku}</span>
      ),
    },
    { id: "onHand", header: "موجود", sortValue: (r) => r.onHand, cell: (r) => <span className="tabular-nums">{faNum(r.onHand)}</span> },
    { id: "reserved", header: "رزرو", sortValue: (r) => r.reserved, cell: (r) => <span className="tabular-nums text-muted-foreground">{faNum(r.reserved)}</span> },
    { id: "available", header: "قابل فروش", sortValue: (r) => r.available, cell: (r) => <span className="font-medium tabular-nums">{faNum(r.available)}</span> },
    { id: "status", header: "وضعیت", sortValue: (r) => r.available, cell: (r) => <StockBadge status={r.status} /> },
    ...(canWrite
      ? [{ id: "actions", header: "", align: "end", cell: (r: InventoryRow) => <AdjustPopover row={r} /> } as Column<InventoryRow>]
      : []),
  ]

  const filters: Filter<InventoryRow>[] = [
    {
      id: "category",
      label: "دسته",
      getValue: (r) => r.product.category,
      options: categories.map((c) => ({ value: c.name, label: categoryFa[c.name] })),
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
  ]

  return (
    <DataTable
      rows={inventory}
      columns={columns}
      getRowKey={(r) => r.product.id}
      searchText={(r) => `${r.product.name} ${r.sku}`}
      searchPlaceholder="جستجوی محصول یا کد کالا…"
      filters={filters}
      pageSize={10}
    />
  )
}
