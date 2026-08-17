"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { faNum, formatPrice } from "@/lib/products";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductStatusBadge } from "./product-status-badge";

function isMissingShippingWeight(product: ProductListItem): boolean {
  return product.is_active && (product.weight == null || product.weight <= 0);
}

function ProductListThumb({ product }: { product: ProductListItem }) {
  const src = product.image_response?.image_url;
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/[0.06]">
      {src ? (
        // Serving URL is already public (`/media/...` or a CDN href).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span
          className="flex size-full items-center justify-center font-serif text-sm text-muted-foreground"
          aria-hidden
        >
          {product.title.trim().charAt(0) || "ر"}
        </span>
      )}
    </span>
  );
}

function variantCountLabel(product: ProductListItem): string {
  if (product.active_variant_count <= 0) return "بدون تنوع";
  return `${faNum(product.active_variant_count)} تنوع`;
}

/**
 * Current-page admin product rows. Search, status, sort, and paging live on
 * the URL and GET /admin/products — this table must not pretend to filter
 * the whole catalogue.
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

  const missingWeightCount = rows.filter(isMissingShippingWeight).length;

  return (
    <>
      {missingWeightCount > 0 ? (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-warning/25 bg-warning/12 px-4 py-3 text-sm text-warning"
        >
          <p className="font-medium">
            در این صفحه {missingWeightCount} محصول فعال بدون وزن ارسال
          </p>
          <p className="mt-1 text-xs leading-5 opacity-90">
            این شمارش فقط ردیف‌های همین صفحه است. وزن واحد (کیلوگرم) برای محاسبهٔ
            هزینه و محدودیت روش‌های ارسال لازم است. محصول را باز کنید و در بخش
            «مشخصات» وزن را وارد کنید.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {rows.map((product) => {
          const missingWeight = isMissingShippingWeight(product);
          return (
            <article
              key={product.id}
              className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="-m-1 flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <ProductListThumb product={product} />
                  <span className="min-w-0">
                  <span className="block font-medium">{product.title}</span>
                  {product.brand ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {product.brand}
                    </span>
                  ) : null}
                  {missingWeight ? (
                    <span className="mt-1 block text-[11px] font-medium text-warning">
                      وزن ارسال ثبت نشده
                    </span>
                  ) : null}
                  </span>
                </Link>
                <ProductRowMenu
                  product={product}
                  canWrite={canWrite}
                  onDelete={() => {
                    setDeleteError(null);
                    setPendingDelete(product);
                  }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
                <div>
                  <dt className="mb-1.5 text-muted-foreground">قیمت</dt>
                  <dd className="font-medium">{formatPrice(product.min_price)}</dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-muted-foreground">موجودی</dt>
                  <dd className="font-medium tabular-nums">
                    {faNum(product.available_stock)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-muted-foreground">تنوع</dt>
                  <dd className="font-medium">{variantCountLabel(product)}</dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-muted-foreground">وضعیت</dt>
                  <dd>
                    <ProductStatusBadge active={product.is_active} />
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="border-hairline hidden max-h-[min(70dvh,calc(100dvh-16rem))] overflow-auto rounded-2xl bg-card ring-1 ring-foreground/[0.04] md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                محصول
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                موجودی
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                تنوع
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                قیمت
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                وضعیت
              </TableHead>
              <TableHead className="h-10 w-12 text-end text-xs font-medium text-muted-foreground">
                <span className="sr-only">عملیات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((product) => {
              const missingWeight = isMissingShippingWeight(product);
              return (
                <TableRow key={product.id} className="border-border/40">
                  <TableCell>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="-mx-2 -my-1 flex items-center gap-3 rounded-lg px-2 py-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <ProductListThumb product={product} />
                      <span className="min-w-0">
                      <span className="block font-medium">{product.title}</span>
                      {product.brand ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {product.brand}
                        </span>
                      ) : null}
                      {missingWeight ? (
                        <span className="mt-0.5 block text-[11px] font-medium text-warning">
                          وزن ارسال ثبت نشده
                        </span>
                      ) : null}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {faNum(product.available_stock)}
                  </TableCell>
                  <TableCell>{variantCountLabel(product)}</TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {formatPrice(product.min_price)}
                    </span>
                    {product.max_price > product.min_price ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        تا {formatPrice(product.max_price)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ProductStatusBadge active={product.is_active} />
                  </TableCell>
                  <TableCell className="text-end">
                    <ProductRowMenu
                      product={product}
                      canWrite={canWrite}
                      onDelete={() => {
                        setDeleteError(null);
                        setPendingDelete(product);
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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

function ProductRowMenu({
  product,
  canWrite,
  onDelete,
}: {
  product: ProductListItem;
  canWrite: boolean;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="عملیات">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/products/${product.id}`}>
            <Pencil className="size-4" /> ویرایش
          </Link>
        </DropdownMenuItem>
        {canWrite ? (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/admin/products/new?from=${product.id}`}>
                <Copy className="size-4" /> تکثیر
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="size-4" /> حذف
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
