"use client";

import * as React from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { formatPrice } from "@/lib/products";
import type { ProductListItem } from "@/lib/catalog/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserStatusBadge } from "@/components/admin/status-badge";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/stats/components/data-table";

/**
 * Admin product catalogue, backed by live data from GET /admin/products (which,
 * unlike the public list, includes inactive/draft products). The list endpoint
 * carries the lightweight projection — title, brand, price band, active flag —
 * so the table shows exactly those; richer per-product data (category, stock,
 * ratings) lives on the product detail/inventory screens.
 */
export function ProductsTable({
  products,
  canWrite,
}: {
  products: ProductListItem[];
  canWrite: boolean;
}) {
  const [pendingDelete, setPendingDelete] =
    React.useState<ProductListItem | null>(null);

  const columns: Column<ProductListItem>[] = [
    {
      id: "name",
      header: "محصول",
      sortValue: (p) => p.title,
      cell: (p) => (
        <div className="leading-tight">
          <p className="font-medium">{p.title}</p>
          {p.brand ? (
            <p className="text-xs text-muted-foreground">{p.brand}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "price",
      header: "قیمت",
      sortValue: (p) => p.min_price,
      cell: (p) => (
        <div className="leading-tight">
          <p className="font-medium">{formatPrice(p.min_price)}</p>
          {p.max_price > p.min_price ? (
            <p className="text-xs text-muted-foreground">
              تا {formatPrice(p.max_price)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "وضعیت",
      sortValue: (p) => (p.is_active ? "active" : "inactive"),
      cell: (p) => <UserStatusBadge active={p.is_active} />,
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
                <Link href={`/admin/products/${p.id}`}>
                  <Pencil className="size-4" /> ویرایش
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canWrite}
                onSelect={() => toast.success(`«${p.title}» کپی شد (نمونه)`)}
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
  ];

  const filters: Filter<ProductListItem>[] = [
    {
      id: "status",
      label: "وضعیت",
      getValue: (p) => (p.is_active ? "active" : "inactive"),
      options: [
        { value: "active", label: "فعال" },
        { value: "inactive", label: "غیرفعال" },
      ],
    },
  ];

  return (
    <>
      <DataTable
        rows={products}
        columns={columns}
        getRowKey={(p) => String(p.id)}
        searchText={(p) => `${p.title} ${p.brand ?? ""}`}
        searchPlaceholder="جستجوی محصول یا برند…"
        filters={filters}
        rowHref={(p) => `/admin/products/${p.id}`}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف محصول</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{pendingDelete?.title}» مطمئن هستید؟ این عمل قابل
              بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.success(`«${pendingDelete?.title}» حذف شد (نمونه)`);
                setPendingDelete(null);
              }}
            >
              حذف محصول
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
