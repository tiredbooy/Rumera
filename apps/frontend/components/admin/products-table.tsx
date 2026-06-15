"use client"

import * as React from "react"
import Link from "next/link"
import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { products as allProducts, categories, categoryFa, badgeFa, formatPrice, faNum, type Product } from "@/lib/products"
import { inventory } from "@/lib/admin/data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Bottle } from "@/components/bottle"
import { StockBadge } from "@/components/admin/status-badge"
import { DataTable, type Column, type Filter } from "@/components/admin/data-table"

const stockByProduct = new Map(inventory.map((r) => [r.product.id, r]))

export function ProductsTable({ canWrite }: { canWrite: boolean }) {
  const [pendingDelete, setPendingDelete] = React.useState<Product | null>(null)

  const columns: Column<Product>[] = [
    {
      id: "name",
      header: "محصول",
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-8 items-end justify-center">
            <Bottle product={p} className="h-12" />
          </span>
          <div className="leading-tight">
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.maker}</p>
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "دسته",
      sortValue: (p) => p.category,
      cell: (p) => <span className="text-muted-foreground">{categoryFa[p.category]}</span>,
    },
    {
      id: "price",
      header: "قیمت",
      sortValue: (p) => p.price,
      cell: (p) => (
        <div className="leading-tight">
          <p className="font-medium">{formatPrice(p.price)}</p>
          {p.compareAt ? (
            <p className="text-xs text-muted-foreground line-through">{formatPrice(p.compareAt)}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "rating",
      header: "امتیاز",
      sortValue: (p) => p.rating,
      cell: (p) => (
        <span className="text-muted-foreground">
          <span className="text-gold">★</span> {faNum(p.rating)}
        </span>
      ),
    },
    {
      id: "stock",
      header: "موجودی",
      sortValue: (p) => stockByProduct.get(p.id)?.available ?? 0,
      cell: (p) => {
        const row = stockByProduct.get(p.id)
        return row ? <StockBadge status={row.status} /> : <span className="text-muted-foreground">—</span>
      },
    },
    {
      id: "badge",
      header: "برچسب",
      cell: (p) =>
        p.badge ? (
          <Badge className="bg-gold text-gold-foreground">{badgeFa[p.badge]}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      align: "end",
      cell: (p) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="عملیات">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/products/${p.slug}`}>
                  <Pencil className="size-4" /> ویرایش
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canWrite}
                onSelect={() => toast.success(`«${p.name}» کپی شد (نمونه)`)}
              >
                <Copy className="size-4" /> تکثیر
              </DropdownMenuItem>
              {canWrite ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setPendingDelete(p)}
                  >
                    <Trash2 className="size-4" /> حذف
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
    },
  ]

  const filters: Filter<Product>[] = [
    {
      id: "category",
      label: "دسته",
      getValue: (p) => p.category,
      options: categories.map((c) => ({ value: c.name, label: categoryFa[c.name] })),
    },
    {
      id: "stock",
      label: "موجودی",
      getValue: (p) => stockByProduct.get(p.id)?.status ?? "in_stock",
      options: [
        { value: "in_stock", label: "موجود" },
        { value: "low", label: "رو به اتمام" },
        { value: "out", label: "ناموجود" },
      ],
    },
  ]

  return (
    <>
      <DataTable
        rows={allProducts}
        columns={columns}
        getRowKey={(p) => p.id}
        searchText={(p) => `${p.name} ${p.maker}`}
        searchPlaceholder="جستجوی محصول یا سازنده…"
        filters={filters}
        rowHref={(p) => `/admin/products/${p.slug}`}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف محصول</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{pendingDelete?.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success(`«${pendingDelete?.name}» حذف شد (نمونه)`)
                setPendingDelete(null)
              }}
            >
              حذف محصول
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
