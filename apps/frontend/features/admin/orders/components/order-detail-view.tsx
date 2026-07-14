import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { getAdminOrder } from "@/features/orders/api/admin";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { PAYMENT_FA } from "@/features/orders/labels";
import type { Order } from "@/features/orders/types";
import { ApiError } from "@/lib/api/client";
import { faNum, formatPrice } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

import { OrderActions } from "./OrderActions";

export async function OrderDetailView({
  orderId,
  canWrite,
}: {
  orderId: number;
  canWrite: boolean;
}) {
  let order: Order;
  try {
    order = await getAdminOrder(orderId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <nav
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-label="مسیر"
          >
            <Link
              href="/admin/orders"
              className="transition-colors hover:text-foreground"
            >
              سفارش‌ها
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground tabular-nums" dir="ltr">
              #{faNum(order.id)}
            </span>
          </nav>
        }
        title={`سفارش #${faNum(order.id)}`}
        description={`ثبت‌شده در ${faDate(order.created_at)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/orders">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm text-muted-foreground">
            {PAYMENT_FA[order.payment_method]}
          </span>
        </div>
        <OrderActions
          orderId={order.id}
          status={order.status}
          canWrite={canWrite}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    محصول
                  </TableHead>
                  <TableHead className="h-10 text-center text-xs font-medium text-muted-foreground">
                    تعداد
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    قیمت واحد
                  </TableHead>
                  <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                    جمع
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((line) => (
                  <TableRow key={line.id} className="border-border/40">
                    <TableCell className="font-medium">
                      {line.product_title}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {faNum(line.quantity)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPrice(line.unit_price)}
                    </TableCell>
                    <TableCell className="text-end font-medium">
                      {formatPrice(line.total_price)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="space-y-2 border-t border-border/60 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">جمع اقلام</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">هزینهٔ ارسال</dt>
                <dd>
                  {order.shipping_cost
                    ? formatPrice(order.shipping_cost)
                    : "رایگان"}
                </dd>
              </div>
              {order.tax_amount ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">مالیات</dt>
                  <dd>{formatPrice(order.tax_amount)}</dd>
                </div>
              ) : null}
              {order.discount_amount ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <dt>تخفیف</dt>
                  <dd>−{formatPrice(order.discount_amount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border/60 pt-2 font-serif text-lg">
                <dt>مبلغ نهایی</dt>
                <dd className="text-foil">{formatPrice(order.total_amount)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Receipt className="size-4 text-muted-foreground" /> خلاصهٔ سفارش
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">وضعیت</dt>
                <dd>
                  <OrderStatusBadge status={order.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">روش پرداخت</dt>
                <dd>{PAYMENT_FA[order.payment_method]}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">تاریخ ثبت</dt>
                <dd dir="ltr">{faDate(order.created_at)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">تعداد اقلام</dt>
                <dd className="tabular-nums">{faNum(order.items.length)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
