import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  PackageCheck,
  PackageOpen,
  Settings2,
  ShoppingBasket,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { InventoryStockBadge } from "@/features/inventory/components/inventory-stock-badge";
import type {
  InventoryItem,
  InventoryMovement,
} from "@/features/inventory/types";
import { getInventoryStatus } from "@/features/inventory/utils";
import type { Pagination } from "@/lib/api/types";
import { faNum, formatPrice } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { InventoryMovementHistory } from "./inventory-movement-history";
import { ReorderThresholdForm } from "./reorder-threshold-form";
import { StockAdjustmentPopover } from "./stock-adjustment-popover";

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-3 ring-1 ring-border/50">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </dt>
      <dd className="mt-2 font-mono text-lg font-semibold" dir="ltr">
        {value}
      </dd>
      {hint ? (
        <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>
      ) : null}
    </div>
  );
}

export function InventoryVariantView({
  inventory,
  movements,
  movementPagination,
  canWrite,
}: {
  inventory: InventoryItem;
  movements: InventoryMovement[];
  movementPagination: Pagination;
  canWrite: boolean;
}) {
  const status = getInventoryStatus(inventory);
  const identity =
    inventory.sku ?? `واریانت #${faNum(inventory.product_variant_id)}`;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/admin/inventory"
            className="inline-flex min-h-11 items-center rounded-md text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            موجودی / جزئیات واریانت
          </Link>
        }
        title={inventory.product_title}
        description={`${identity} · شناسهٔ واریانت ${faNum(inventory.product_variant_id)}`}
        actions={
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {canWrite ? <StockAdjustmentPopover inventory={inventory} /> : null}
            <Button variant="outline" size="sm" className="h-11" asChild>
              <Link href={`/admin/products/${inventory.product_id}`}>
                مشاهدهٔ محصول
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-11" asChild>
              <Link href="/admin/inventory">
                <ArrowRight className="size-4" aria-hidden /> بازگشت
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="inventory-summary-title"
            className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="inventory-summary-title" className="font-serif text-lg">
                  وضعیت فعلی انبار
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  قیمت واحد {formatPrice(Number(inventory.unit_price))}
                </p>
              </div>
              <InventoryStockBadge status={status} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={Boxes}
                label="موجودی فیزیکی"
                value={faNum(inventory.stock_on_hand)}
              />
              <Metric
                icon={ShoppingBasket}
                label="رزروشده"
                value={faNum(inventory.committed_stock)}
              />
              <Metric
                icon={PackageCheck}
                label="قابل فروش"
                value={faNum(inventory.available_stock)}
              />
              <Metric
                icon={PackageOpen}
                label="پیشنهاد تأمین"
                value={faNum(inventory.reorder_quantity)}
                hint={`آستانه ${faNum(inventory.reorder_point)}`}
              />
            </dl>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden /> آخرین تغییر:{" "}
                {faDateTime(inventory.updated_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden /> آخرین تأمین:{" "}
                {inventory.last_restock_at
                  ? faDateTime(inventory.last_restock_at)
                  : "ثبت نشده"}
              </span>
            </div>
          </section>

          <InventoryMovementHistory
            variantID={inventory.product_variant_id}
            movements={movements}
            pagination={movementPagination}
          />
        </div>

        <aside className="border-hairline h-fit rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] xl:sticky xl:top-20">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 font-serif text-lg">
              <Settings2 className="size-4.5 text-primary" aria-hidden />{" "}
              آستانه‌های تأمین
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              آستانه، هشدار کمبود را کنترل می‌کند؛ مقدار سفارش فقط پیشنهاد
              عملیاتی است.
            </p>
          </div>
          {canWrite ? (
            <ReorderThresholdForm
              key={`${inventory.reorder_point}:${inventory.reorder_quantity}`}
              inventory={inventory}
            />
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Metric
                icon={PackageCheck}
                label="آستانهٔ سفارش"
                value={faNum(inventory.reorder_point)}
              />
              <Metric
                icon={PackageOpen}
                label="مقدار پیشنهادی"
                value={faNum(inventory.reorder_quantity)}
              />
            </dl>
          )}
        </aside>
      </div>
    </>
  );
}
