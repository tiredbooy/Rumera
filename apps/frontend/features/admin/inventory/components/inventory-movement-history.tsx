import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  PackageSearch,
} from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import { Badge } from "@/components/ui/badge";
import type { Pagination } from "@/lib/api/types";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";
import type {
  InventoryMovement,
  MovementType,
} from "@/features/inventory/types";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase: "فروش قطعی",
  restock: "تأمین انبار",
  refund: "مرجوعی",
  adjustment: "اصلاح دستی",
  reservation: "رزرو سفارش",
  release: "آزادسازی رزرو",
  damage: "ضایعات",
};

export function inventoryMovementPageHref(
  variantID: number,
  page: number,
): string {
  const base = `/admin/inventory/${variantID}`;
  return page > 1 ? `${base}?movement_page=${page}` : base;
}

function signedQuantity(quantity: number): string {
  if (quantity > 0) return `+${faNum(quantity)}`;
  if (quantity < 0) return `−${faNum(Math.abs(quantity))}`;
  return faNum(0);
}

export function InventoryMovementHistory({
  variantID,
  movements,
  pagination,
}: {
  variantID: number;
  movements: InventoryMovement[];
  pagination: Pagination;
}) {
  return (
    <section aria-labelledby="inventory-history-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="inventory-history-title"
            className="flex items-center gap-2 font-serif text-lg"
          >
            <History className="size-4.5 text-primary" aria-hidden /> تاریخچهٔ
            گردش موجودی
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            رویدادهای ثبت‌شده نمایش داده می‌شوند؛ این داده شامل نام عامل یا
            ماندهٔ لحظه‌ای نیست.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {faNum(pagination.total_items)} رویداد
        </p>
      </div>

      {movements.length === 0 ? (
        <div className="border-hairline flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl bg-card px-5 text-center ring-1 ring-foreground/[0.04]">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">هنوز گردش موجودی ثبت نشده است</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              نخستین تعدیل، تأمین، رزرو یا فروش این واریانت در اینجا دیده
              می‌شود.
            </p>
          </div>
        </div>
      ) : (
        <ol className="grid gap-3">
          {movements.map((movement) => {
            const increase = movement.quantity > 0;
            const MovementIcon = increase ? ArrowDownToLine : ArrowUpFromLine;
            return (
              <li key={movement.id}>
                <article className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04] sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={
                          increase
                            ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/12 text-success ring-1 ring-success/25"
                            : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/15"
                        }
                      >
                        <MovementIcon className="size-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium">
                            {MOVEMENT_LABELS[movement.type]}
                          </h3>
                          <Badge variant="outline">
                            <bdi dir="ltr">#{faNum(movement.id)}</bdi>
                          </Badge>
                        </div>
                        {movement.note ? (
                          <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
                            <bdi dir="auto">{movement.note}</bdi>
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            بدون یادداشت
                          </p>
                        )}
                        {movement.reference_order_id ? (
                          <Link
                            href={`/admin/orders/${movement.reference_order_id}`}
                            className="mt-2 inline-flex min-h-11 items-center rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            سفارش #{faNum(movement.reference_order_id)}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <span
                        className={
                          increase
                            ? "font-mono text-base font-semibold text-success"
                            : "font-mono text-base font-semibold text-destructive"
                        }
                        dir="ltr"
                      >
                        {signedQuantity(movement.quantity)}
                      </span>
                      <time
                        dateTime={movement.created_at}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        {faDateTime(movement.created_at)}
                      </time>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <ListPagination
        page={pagination.page}
        totalPages={pagination.total_pages}
        hasPrev={pagination.has_prev}
        hasNext={pagination.has_next}
        prevHref={inventoryMovementPageHref(variantID, pagination.page - 1)}
        nextHref={inventoryMovementPageHref(variantID, pagination.page + 1)}
        ariaLabel="صفحه‌بندی گردش موجودی"
        className="mt-4"
      />
    </section>
  );
}
