"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  XCircle,
  RotateCcw,
  MessageSquarePlus,
} from "lucide-react";

import { faNum, formatPrice } from "@/lib/products";
import {
  ORDER_STATUS_FA,
  PAYMENT_FA,
  isCancellable,
} from "@/features/orders/labels";
import { faDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "@/components/smart-image";
import { useBulkAddCartItems } from "@/features/cart/api";
import { useCancelOrder, useOrder } from "@/features/orders/hooks";
import { AccountSection } from "../../account/components/account-section";
import { OrderStatusStepper } from "./OrderStatusStepper";

export function OrderDetail({ id }: { id: number }) {
  const { data: order, isLoading, isError } = useOrder(id);
  const cancel = useCancelOrder();
  const reorder = useBulkAddCartItems();

  if (isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (isError || !order) {
    return (
      <div className="border-hairline rounded-2xl bg-card p-8 text-center ring-1 ring-foreground/5">
        <p className="text-muted-foreground">سفارش یافت نشد.</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/account/orders">بازگشت به سفارش‌ها</Link>
        </Button>
      </div>
    );
  }

  const isDelivered = order.status === "delivered";

  function doReorder() {
    if (!order) return;
    const items = order.items.map((it) => ({
      product_variant_id: it.variant_id,
      quantity: it.quantity,
    }));
    reorder.mutate(items, {
      onSuccess: (res) => {
        toast.success("اقلام سفارش به سبد خرید افزوده شد", {
          description:
            res.skipped.length > 0
              ? `${faNum(res.skipped.length)} قلم در دسترس نبود`
              : undefined,
          action: {
            label: "مشاهدهٔ سبد",
            onClick: () => (window.location.href = "/cart"),
          },
        });
      },
      onError: () => toast.error("افزودن به سبد ناموفق بود"),
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      {/* Main column */}
      <div className="flex flex-col gap-5">
        <AccountSection title="اقلام سفارش">
          <ul className="divide-y divide-border/60">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-foreground/5">
                  <SmartImage
                    src={item.image_url}
                    alt={item.product_title}
                    sizes="64px"
                    monogram={item.product_title.charAt(0)}
                    fallbackClassName="from-accent/40 via-card to-secondary"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.product_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {faNum(item.quantity)} × {formatPrice(item.unit_price)}
                  </p>
                  {isDelivered ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary"
                      asChild
                    >
                      <Link href="/account/reviews">
                        <MessageSquarePlus className="size-3.5" /> ثبت دیدگاه
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <span className="shrink-0 font-medium">
                  {formatPrice(item.total_price)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-border/60 pt-5 text-sm">
            <Row label="جمع جزء" value={formatPrice(order.subtotal)} />
            {order.discount_amount > 0 ? (
              <Row
                label="تخفیف"
                value={`− ${formatPrice(order.discount_amount)}`}
              />
            ) : null}
            {order.tax_amount > 0 ? (
              <Row label="مالیات" value={formatPrice(order.tax_amount)} />
            ) : null}
            <Row
              label="ارسال"
              value={
                order.shipping_cost > 0
                  ? formatPrice(order.shipping_cost)
                  : "رایگان"
              }
            />
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <dt className="font-medium">مبلغ کل</dt>
              <dd className="font-serif text-xl text-foil">
                {formatPrice(order.total_amount)}
              </dd>
            </div>
          </dl>
        </AccountSection>

      </div>

      {/* Side column: status + actions */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <AccountSection title="وضعیت سفارش">
          <div className="mb-4 flex items-center gap-2">
            <Badge
              variant={
                order.status === "cancelled" ? "destructive" : "secondary"
              }
            >
              {ORDER_STATUS_FA[order.status] ?? order.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {faDate(order.created_at)}
            </span>
          </div>
          <OrderStatusStepper status={order.status} orientation="vertical" />
          <p className="mt-2 text-xs text-muted-foreground">
            روش پرداخت:{" "}
            {PAYMENT_FA[order.payment_method] ?? order.payment_method}
          </p>
        </AccountSection>

        <AccountSection title="اقدام‌ها" bodyClassName="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            disabled={reorder.isPending}
            onClick={doReorder}
          >
            {reorder.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            سفارش مجدد
          </Button>
          {isCancellable(order.status) ? (
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(order.id, {
                  onSuccess: () => toast.success("سفارش لغو شد"),
                  onError: () => toast.error("لغو سفارش ناموفق بود"),
                })
              }
            >
              {cancel.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              لغو سفارش
            </Button>
          ) : null}
        </AccountSection>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
