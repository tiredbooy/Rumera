"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { formatPrice } from "@/lib/products";
import type { ProductListItem } from "@/features/catalog/products/types";
import { deleteProduct } from "@/features/admin/products/actions/product";
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
import { ProductStatusBadge } from "./product-status-badge";
import {
  DataTable,
  type Column,
  type Filter,
} from "@/features/admin/analytics/components/DataTable";

/**
 * Admin product catalogue, backed by live data from GET /admin/products (which,
 * unlike the public list, includes inactive/draft products). Destructive delete
 * calls the real admin DELETE endpoint; there is no supported product-duplicate
 * API, so that control is intentionally omitted rather than faked.
 */
export function ProductsTable({
  products,
  canWrite,
}: {
  products: ProductListItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] =
    React.useState<ProductListItem | null>(null);
  const [isDeleting, startDelete] = React.useTransition();
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState(products);

  React.useEffect(() => {
    setRows(products);
  }, [products]);

  function confirmDelete() {
    if (!pendingDelete || isDeleting) return;
    const target = pendingDelete;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteProduct(target.id);
      if (!result.ok) {
        setDeleteError(result.message);
        toast.error(result.message);
        return;
      }
      setRows((current) => current.filter((p) => p.id !== target.id));
      setPendingDelete(null);
      toast.success(`«${target.title}» حذف شد`);
      router.refresh();
    });
  }

  const missingWeightCount = rows.filter(
    (p) => p.is_active && (p.weight == null || p.weight <= 0),
  ).length;

  const columns: Column<ProductListItem>[] = [
    {
      id: "name",
      header: "محصول",
      sortValue: (p) => p.title,
      cell: (p) => {
        const missingWeight = p.is_active && (p.weight == null || p.weight <= 0);
        return (
          <div className="leading-tight">
            <p className="font-medium">{p.title}</p>
            {p.brand ? (
              <p className="text-xs text-muted-foreground">{p.brand}</p>
            ) : null}
            {missingWeight ? (
              <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                وزن ارسال ثبت نشده
              </p>
            ) : null}
          </div>
        );
      },
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
      cell: (p) => <ProductStatusBadge active={p.is_active} />,
    },
    {
      id: "actions",
      header: "",
      align: "end",
      cell: (p) => (
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
            {canWrite ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setDeleteError(null);
                    setPendingDelete(p);
                  }}
                >
                  <Trash2 className="size-4" /> حذف
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
    {
      id: "shipping_weight",
      label: "وزن ارسال",
      getValue: (p) =>
        p.is_active && (p.weight == null || p.weight <= 0)
          ? "missing"
          : "ok",
      options: [
        { value: "missing", label: "فعال بدون وزن" },
        { value: "ok", label: "وزن ثبت‌شده / غیرفعال" },
      ],
    },
  ];

  return (
    <>
      {missingWeightCount > 0 ? (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">
            {missingWeightCount} محصول فعال بدون وزن ارسال
          </p>
          <p className="mt-1 text-xs leading-5 opacity-90">
            وزن واحد (کیلوگرم) برای محاسبهٔ هزینه و محدودیت روش‌های ارسال لازم
            است. محصول را باز کنید و در بخش «مشخصات» وزن را وارد کنید.
          </p>
        </div>
      ) : null}
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(p) => String(p.id)}
        searchText={(p) => `${p.title} ${p.brand ?? ""}`}
        searchPlaceholder="جستجوی محصول یا برند…"
        filters={filters}
        rowHref={(p) => `/admin/products/${p.id}`}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!isDeleting && !open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف محصول</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{pendingDelete?.title}» مطمئن هستید؟ این عمل از کاتالوگ
              مدیریتی محصول را حذف می‌کند و قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {isDeleting ? "در حال حذف…" : "حذف محصول"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
