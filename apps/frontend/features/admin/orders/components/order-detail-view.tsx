import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CreditCard,
  Gift,
  MapPin,
  Receipt,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

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
import { PAYMENT_STATUS_FA } from "@/features/payments/presentation";
import type { PaymentStatus } from "@/features/payments/types";
import { ApiError } from "@/lib/api/client";
import { faNum, formatPrice } from "@/lib/products";
import { faDate } from "@/lib/utils/date";

import { buildOrderTimeline } from "../order-timeline";
import type {
  AdminOrder,
  AdminOrderPaymentSummary,
  AdminOrderShipTo,
  AdminOrderShippingMethod,
  AdminOrderUser,
} from "../types";
import { OrderActions } from "./OrderActions";

const MISSING = "ثبت نشده";

export async function OrderDetailView({
  orderId,
  canWrite,
}: {
  orderId: number;
  canWrite: boolean;
}) {
  let order: AdminOrder;
  try {
    order = (await getAdminOrder(orderId)) as AdminOrder;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const shipTo = order.ship_to ?? order.address ?? null;
  const payment = paymentSummary(order);

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
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="font-serif text-2xl text-foil tabular-nums">
            {formatPrice(order.total_amount)}
          </span>
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

      <div className="mb-6">
        <OrderTimelineCard order={order} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
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
                <div className="flex justify-between text-success">
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
          <SideCard title="خلاصهٔ سفارش" icon={Receipt}>
            <dl className="space-y-2.5 text-sm">
              <DetailRow label="وضعیت">
                <OrderStatusBadge status={order.status} />
              </DetailRow>
              <DetailRow label="روش پرداخت">
                {PAYMENT_FA[order.payment_method]}
              </DetailRow>
              <DetailRow label="روش ارسال">
                <ShippingMethodValue
                  method={order.shipping_method}
                  fallbackId={order.shipping_method_id}
                />
              </DetailRow>
              <DetailRow label="کوپن">
                <TextValue
                  value={order.coupon?.code ?? order.coupon_code}
                  dir="ltr"
                />
              </DetailRow>
              <DetailRow label="تاریخ ثبت">
                <span dir="ltr">{faDate(order.created_at)}</span>
              </DetailRow>
              <DetailRow label="تعداد اقلام">
                <span className="tabular-nums">{faNum(order.items.length)}</span>
              </DetailRow>
            </dl>
          </SideCard>

          <PaymentSummaryCard
            payment={payment}
            amount={order.total_amount}
            paidAt={order.paid_at}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BuyerCard user={order.user} userId={order.user_id} />
        <ShipToCard shipTo={shipTo} />
      </div>

      {hasFulfillmentExtras(order) ? (
        <div className="mt-6">
          <FulfillmentExtrasCard order={order} />
        </div>
      ) : null}
    </>
  );
}

function OrderTimelineCard({ order }: { order: AdminOrder }) {
  const events = buildOrderTimeline(order);
  return (
    <SideCard title="روند سفارش" icon={Receipt}>
      <ol className="space-y-3">
        {events.map((event) => (
          <li key={event.key} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span
                className={
                  event.current
                    ? "mt-1 size-2 shrink-0 rounded-full bg-primary"
                    : "mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/40"
                }
                aria-hidden
              />
              <span className={event.current ? "font-medium" : undefined}>
                {event.label}
              </span>
            </div>
            {event.at ? (
              <time
                className="shrink-0 text-sm text-muted-foreground"
                dateTime={event.at}
                dir="ltr"
              >
                {faDate(event.at)}
              </time>
            ) : (
              <span className="text-sm text-muted-foreground">اکنون</span>
            )}
          </li>
        ))}
      </ol>
    </SideCard>
  );
}

function BuyerCard({
  user,
  userId,
}: {
  user?: AdminOrderUser | null;
  userId?: number;
}) {
  const name = joinName(user?.first_name, user?.last_name);
  const numericId = user?.id || userId;
  const publicId = present(user?.user_id);

  return (
    <SideCard title="خریدار" icon={UserRound}>
      <dl className="space-y-2.5 text-sm">
        <DetailRow label="نام">
          <TextValue value={name} />
        </DetailRow>
        <DetailRow label="تلفن">
          <TextValue value={user?.phone} dir="ltr" />
        </DetailRow>
        <DetailRow label="شناسه کاربر">
          {numericId ? (
            <span className="tabular-nums" dir="ltr">
              {faNum(numericId)}
            </span>
          ) : (
            <Missing />
          )}
        </DetailRow>
        <DetailRow label="شناسه عمومی">
          {publicId ? (
            <Link
              href={`/admin/customers/${publicId}`}
              className="break-all underline-offset-4 hover:underline"
              dir="ltr"
            >
              {publicId}
            </Link>
          ) : (
            <Missing />
          )}
        </DetailRow>
        <DetailRow label="ایمیل">
          <TextValue value={user?.email} dir="ltr" />
        </DetailRow>
      </dl>
    </SideCard>
  );
}

function ShipToCard({ shipTo }: { shipTo: AdminOrderShipTo | null }) {
  return (
    <SideCard title="نشانی ارسال" icon={MapPin}>
      {/* Snapshot from place-order — live address book can change after. */}
      <dl className="space-y-2.5 text-sm">
        <DetailRow label="نام">
          <TextValue value={shipTo?.full_name} />
        </DetailRow>
        <DetailRow label="تلفن">
          <TextValue value={shipTo?.phone_number} dir="ltr" />
        </DetailRow>
        <DetailRow label="نشانی">
          <TextValue value={streetLine(shipTo)} />
        </DetailRow>
        <DetailRow label="شهر">
          <TextValue value={shipTo?.city} />
        </DetailRow>
        <DetailRow label="استان">
          <TextValue value={shipTo?.state_province} />
        </DetailRow>
        <DetailRow label="کد پستی">
          <TextValue value={shipTo?.postal_code} dir="ltr" />
        </DetailRow>
        <DetailRow label="کشور">
          <TextValue value={shipTo?.country} dir="ltr" />
        </DetailRow>
      </dl>
    </SideCard>
  );
}

function FulfillmentExtrasCard({ order }: { order: AdminOrder }) {
  const giftMessage = present(order.gift_message);
  const notes = present(order.notes);
  const scheduled = present(order.scheduled_delivery_date);
  const addons = (order.gift_addons ?? []).filter((addon) =>
    present(addon.label),
  );

  return (
    <SideCard title="هدیه و یادداشت" icon={Gift}>
      <dl className="space-y-3 text-sm">
        {order.is_gift ? <DetailRow label="سفارش هدیه">بله</DetailRow> : null}
        {giftMessage ? (
          <StackedDetail label="پیام هدیه">«{giftMessage}»</StackedDetail>
        ) : null}
        {addons.length > 0 ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">بسته‌بندی و افزونه‌ها</dt>
            <dd>
              <ul className="space-y-1">
                {addons.map((addon) => (
                  <li
                    key={addon.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <span>{addon.label}</span>
                    <span className="tabular-nums">
                      {addon.price > 0 ? formatPrice(addon.price) : "رایگان"}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {scheduled ? (
          <DetailRow label="تاریخ ترجیحی تحویل">
            <span dir="ltr">{faDate(scheduled)}</span>
          </DetailRow>
        ) : null}
        {notes ? <StackedDetail label="یادداشت">{notes}</StackedDetail> : null}
      </dl>
    </SideCard>
  );
}

function PaymentSummaryCard({
  payment,
  amount,
  paidAt,
}: {
  payment: AdminOrderPaymentSummary | null;
  amount: number;
  paidAt?: string;
}) {
  return (
    <SideCard title="خلاصهٔ پرداخت" icon={CreditCard}>
      <dl className="space-y-2.5 text-sm">
        <DetailRow label="مبلغ">{formatPrice(amount)}</DetailRow>
        <DetailRow label="تاریخ پرداخت">
          {paidAt ? (
            <span dir="ltr">{faDate(paidAt)}</span>
          ) : (
            <Missing />
          )}
        </DetailRow>
        {payment ? (
          <>
            <DetailRow label="شناسه تراکنش">
              {payment.id ? (
                <Link
                  href={`/admin/payments/${payment.id}`}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  #{faNum(payment.id)}
                </Link>
              ) : (
                <Missing />
              )}
            </DetailRow>
            <DetailRow label="شناسه درگاه">
              <TextValue value={payment.transaction_id} dir="ltr" />
            </DetailRow>
            <DetailRow label="وضعیت تراکنش">
              <TextValue value={paymentStatusLabel(payment.status)} />
            </DetailRow>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            تراکنش پرداختی ثبت نشده است
          </p>
        )}
      </dl>
    </SideCard>
  );
}

function ShippingMethodValue({
  method,
  fallbackId,
}: {
  method?: AdminOrderShippingMethod | null;
  fallbackId?: number | null;
}) {
  const name = present(method?.name);
  const carrier = present(method?.carrier);
  if (name || carrier) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Truck className="size-3.5 text-muted-foreground" aria-hidden />
        {[name, carrier].filter(Boolean).join(" · ")}
      </span>
    );
  }
  const id = method?.id || fallbackId;
  if (id) {
    return (
      <span className="tabular-nums" dir="ltr">
        #{faNum(id)}
      </span>
    );
  }
  return <Missing />;
}

function SideCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  );
}

function StackedDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}

function TextValue({
  value,
  dir,
}: {
  value?: string | null;
  dir?: "ltr";
}) {
  const text = present(value);
  if (!text) return <Missing />;
  return dir ? <span dir={dir}>{text}</span> : text;
}

function Missing() {
  return <span className="text-muted-foreground">{MISSING}</span>;
}

function present(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasFulfillmentExtras(order: AdminOrder): boolean {
  return (
    order.is_gift === true ||
    Boolean(present(order.gift_message)) ||
    Boolean(order.gift_addons?.some((addon) => present(addon.label))) ||
    Boolean(present(order.notes)) ||
    Boolean(present(order.scheduled_delivery_date))
  );
}

function joinName(
  first?: string | null,
  last?: string | null,
): string | undefined {
  const name = [first, last].map(present).filter(Boolean).join(" ").trim();
  return name || undefined;
}

function streetLine(shipTo: AdminOrderShipTo | null): string | undefined {
  if (!shipTo) return undefined;
  const line = [shipTo.address_line1, shipTo.address_line2]
    .map(present)
    .filter(Boolean)
    .join("، ");
  return line || undefined;
}

function paymentSummary(order: AdminOrder): AdminOrderPaymentSummary | null {
  if (order.payment) return order.payment;
  if (!order.payment_id && !present(order.transaction_id)) return null;
  return {
    id: order.payment_id ?? 0,
    transaction_id: order.transaction_id ?? "",
    payment_url: order.payment_url,
  };
}

function paymentStatusLabel(status?: string): string | undefined {
  if (!present(status)) return undefined;
  return PAYMENT_STATUS_FA[status as PaymentStatus] ?? status;
}
