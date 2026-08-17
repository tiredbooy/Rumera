import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  CircleAlert,
  Clock,
  Gift,
  Mail,
  Package,
  Truck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getAccountOrder } from "@/features/orders/api/account"
import {
  ORDER_STATUS_FA,
  canStartOrderPay,
  isPayable,
  orderPayCtaLabel,
} from "@/features/orders/labels"
import type { Order } from "@/features/orders/types"
import { ApiError } from "@/lib/api/client"
import { faNum, formatPrice } from "@/lib/products"

async function getOrder(id: number): Promise<Order | null> {
  try {
    return await getAccountOrder(id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

type OrderConfirmationViewProps = {
  id: string
}

export async function OrderConfirmationView({ id }: OrderConfirmationViewProps) {
  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()
  const order = await getOrder(orderId)
  if (!order) notFound()

  const scheduled = order.scheduled_delivery_date
    ? new Date(order.scheduled_delivery_date).toLocaleDateString("fa-IR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null

  // Points are granted after payment settles (not on order create alone) — PH-040c.
  const isPaidLike =
    order.status === "paid" ||
    order.status === "processing" ||
    order.status === "ready_to_ship" ||
    order.status === "shipped" ||
    order.status === "out_for_delivery" ||
    order.status === "delivered"

  const hero = confirmationHero(order.status, isPaidLike, order.payment_method)
  const HeroIcon = hero.Icon

  return (
    <section className="container-px mx-auto max-w-3xl py-14 lg:py-20">
      <div className="cellar-glow border-hairline relative overflow-hidden rounded-3xl px-6 py-12 text-center ring-1 ring-foreground/10">
        <span
          className={`mx-auto mb-6 flex size-20 items-center justify-center rounded-full ${hero.iconClass}`}
        >
          <HeroIcon className="size-10" />
        </span>
        <p className="eyebrow">{hero.eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{hero.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">{hero.body}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-4 py-1.5 text-sm font-medium backdrop-blur-sm ring-1 ring-foreground/10">
            شمارهٔ سفارش: <span className="text-foil tabular-nums">#{faNum(order.id)}</span>
          </span>
          <Badge variant="secondary">{ORDER_STATUS_FA[order.status]}</Badge>
        </div>
      </div>

      {/* Delivery estimate / next info strip */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="border-hairline flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Truck className="size-5" />
          </span>
          <div>
            <p className="font-medium">زمان تحویل تخمینی</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {scheduled ? `تحویل برنامه‌ریزی‌شده برای ${scheduled}` : "۲ تا ۵ روز کاری پس از تأیید پرداخت"}
            </p>
          </div>
        </div>
        <div className="border-hairline flex items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Mail className="size-5" />
          </span>
          <div>
            <p className="font-medium">به‌روزرسانی وضعیت</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              تغییرات وضعیت سفارش را از بخش «سفارش‌های من» دنبال کنید.
            </p>
          </div>
        </div>
      </div>

      {/* Loyalty transparency (earn after paid — PH-040c) */}
      <div className="border-hairline mt-6 rounded-2xl bg-card px-6 py-5 ring-1 ring-foreground/5">
        <p className="flex items-center gap-2 font-medium text-primary">
          <Award className="size-4" /> باشگاه مشتریان
        </p>
        {isPaidLike ? (
          <p className="mt-2 text-sm text-muted-foreground">
            امتیاز این خرید (در صورت تعلق) به حساب باشگاه شما افزوده شده یا به‌زودی
            ثبت می‌شود. جزئیات را در تاریخچهٔ امتیاز ببینید.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            امتیاز باشگاه پس از{" "}
            <strong className="font-medium text-foreground">تأیید پرداخت</strong>{" "}
            محاسبه می‌شود — ثبت سفارش به‌تنهایی امتیاز نمی‌دهد.
          </p>
        )}
        <Button asChild variant="link" className="mt-2 h-auto px-0">
          <Link href="/account/rewards">مشاهدهٔ باشگاه مشتریان</Link>
        </Button>
      </div>

      {order.is_gift ? (
        <div className="border-hairline mt-6 rounded-2xl bg-card px-6 py-5 ring-1 ring-foreground/5">
          <p className="flex items-center gap-2 font-medium text-primary">
            <Gift className="size-4" /> این سفارش به‌عنوان هدیه ثبت شد
          </p>
          {order.gift_message ? (
            <p className="mt-2 text-sm text-muted-foreground">«{order.gift_message}»</p>
          ) : null}
          {order.gift_addons && order.gift_addons.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {order.gift_addons.map((addon) => (
                <li key={addon.id} className="flex justify-between gap-3">
                  <span>{addon.label}</span>
                  <span className="tabular-nums">
                    {addon.price > 0 ? formatPrice(addon.price) : "رایگان"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {!order.gift_addons?.length && order.gift_wrap ? (
              <span>با بسته‌بندی هدیه</span>
            ) : null}
            {order.gift_addons_fee && order.gift_addons_fee > 0 ? (
              <span>
                هزینهٔ افزونه‌ها: {formatPrice(order.gift_addons_fee)}
              </span>
            ) : null}
            {order.hide_price ? <span>قیمت در رسید مخفی می‌شود</span> : null}
            {scheduled ? <span>تاریخ تحویل: {scheduled}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="border-hairline mt-6 rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <Package className="size-5 text-primary" /> اقلام سفارش
        </h2>
        <ul className="mt-4 divide-y divide-border/60">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.product_title}</span>
                <span className="text-xs text-muted-foreground">
                  {faNum(item.quantity)} × {formatPrice(item.unit_price)}
                </span>
              </span>
              <span className="font-medium tabular-nums">{formatPrice(item.total_price)}</span>
            </li>
          ))}
        </ul>

        <Separator className="my-5" />

        <dl className="space-y-2 text-sm">
          <Row label="جمع جزء" value={formatPrice(order.subtotal)} />
          {order.discount_amount > 0 ? <Row label="تخفیف" value={`− ${formatPrice(order.discount_amount)}`} /> : null}
          <Row label="ارسال" value={order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : "رایگان"} />
          {order.gift_addons_fee && order.gift_addons_fee > 0 ? (
            <Row
              label="بسته‌بندی و افزونهٔ هدیه"
              value={formatPrice(order.gift_addons_fee)}
            />
          ) : null}
          <div className="flex items-center justify-between border-t border-border/60 pt-3">
            <dt className="font-medium">مبلغ کل</dt>
            <dd className="font-serif text-xl text-foil tabular-nums">{formatPrice(order.total_amount)}</dd>
          </div>
        </dl>
      </div>

      {/*
        U-1: these CTAs used to be status-blind, so an order still awaiting
        payment offered only "track order" and "keep shopping" while the hero
        text described the remedy in prose. Money left uncollected. The action
        that actually resolves the order now leads.
      */}
      {/*
        U-1: these CTAs used to be status-blind, so an order still awaiting
        payment offered only "track order" and "keep shopping" while the hero
        described the remedy in prose. The action that resolves the order now
        leads, labelled by status.

        Links, not an inline pay button: this screen is a server component, and
        `usePayOrder` would drag a QueryClientProvider into its render. The live
        pay control already exists on the order page, and wallet orders cannot
        start a gateway payment at all (`POST /orders/:id/pay` refuses them), so
        for those the only move that leads anywhere is topping up.
      */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {isPayable(order.status) && order.payment_method === "wallet" ? (
          <Button asChild size="lg" className="h-12">
            <Link href="/account/wallet" data-testid="confirmation-topup-cta">
              شارژ کیف پول <ArrowLeft />
            </Link>
          </Button>
        ) : null}
        {canStartOrderPay(order) ? (
          <Button asChild size="lg" className="h-12">
            <Link
              href={`/account/orders/${order.id}`}
              data-testid="confirmation-pay-cta"
            >
              {orderPayCtaLabel(order.status)} <ArrowLeft />
            </Link>
          </Button>
        ) : null}
        <Button
          asChild
          size="lg"
          variant={isPayable(order.status) ? "outline" : "default"}
          className="h-12"
        >
          <Link href={`/account/orders/${order.id}`}>
            پیگیری سفارش <ArrowLeft />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12">
          <Link href="/products">ادامهٔ خرید</Link>
        </Button>
      </div>
    </section>
  )
}

function confirmationHero(
  status: Order["status"],
  isPaidLike: boolean,
  paymentMethod: Order["payment_method"],
) {
  const isWallet = paymentMethod === "wallet"

  if (isPaidLike) {
    return {
      Icon: CheckCircle2,
      iconClass: "bg-primary/15 text-primary ring-1 ring-primary/25",
      eyebrow: "سفارش تأیید شد",
      title: "سپاس از خرید شما",
      body: isWallet
        ? "سفارش شما با موفقیت ثبت شد و مبلغ از کیف پول برداشت شد. جزئیات را برای پیگیری در دسترس نگه داشته‌ایم."
        : "سفارش شما با موفقیت ثبت شد. جزئیات را برای پیگیری در دسترس نگه داشته‌ایم.",
    }
  }
  if (status === "payment_failed") {
    return {
      Icon: CircleAlert,
      iconClass: "bg-destructive/10 text-destructive ring-1 ring-destructive/25",
      eyebrow: "سفارش ثبت شد",
      title: "پرداخت ناموفق",
      body: isWallet
        ? "پرداخت از کیف پول انجام نشد. مبلغی برداشت نشده است یا در صورت کسر، بازگردانده شده است. از پیگیری سفارش دوباره تلاش کنید."
        : "پرداخت این سفارش انجام نشد. مبلغی برداشت نشده است. از پیگیری سفارش دوباره تلاش کنید.",
    }
  }
  if (status === "pending") {
    return {
      Icon: Clock,
      iconClass: "bg-secondary text-primary ring-1 ring-foreground/10",
      eyebrow: "سفارش ثبت شد",
      title: "در انتظار پرداخت",
      body: isWallet
        ? "سفارش ثبت شد و هنوز پرداخت نشده است. انتخاب کیف پول به‌معنای انجام پرداخت نیست. اگر موجودی کافی نبوده، ابتدا موجودی را افزایش دهید و دوباره تلاش کنید."
        : "سفارش ثبت شد و هنوز پرداخت نشده است. تا پرداخت موفق، وجهی دریافت نمی‌شود.",
    }
  }
  return {
    Icon: Package,
    iconClass: "bg-secondary text-muted-foreground ring-1 ring-foreground/10",
    eyebrow: "سفارش ثبت شد",
    title: ORDER_STATUS_FA[status],
    body: isWallet
      ? "سفارش ثبت شد. وضعیت فعلی را از نشان سفارش ببینید — این صفحه به‌تنهایی کسر از کیف پول را نشان نمی‌دهد."
      : "سفارش ثبت شد. وضعیت فعلی را از نشان سفارش ببینید — این صفحه برداشت وجه را نشان نمی‌دهد.",
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
