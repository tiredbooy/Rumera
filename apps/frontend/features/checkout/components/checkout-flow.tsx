"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  Check,
  MapPin,
  Truck,
  Tag,
  Wallet,
  Landmark,
  Gift,
  ShieldCheck,
  Lock,
  ChevronRight,
  ChevronLeft,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatPrice, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useAddresses } from "@/features/addresses/api"
import { useCart } from "@/features/cart/api"
import { useValidateCoupon } from "@/features/coupons/api"
import { usePlaceOrder } from "@/features/orders/hooks"
import { useShippingMethods } from "@/features/shipping/api"
import type { Address } from "@/features/addresses/types"
import type { CouponValidation } from "@/features/coupons/types"
import type { PaymentMethod } from "@/features/orders/types"
import type { ShippingMethod } from "@/features/shipping/types"
import { ApiClientError } from "@/lib/api/store-client"
import { AddAddressForm } from "./add-address-form"

const SHIP_REGION = "IR"

const STEPS = [
  { key: "address", label: "آدرس", icon: MapPin },
  { key: "shipping", label: "ارسال", icon: Truck },
  { key: "payment", label: "پرداخت", icon: Wallet },
  { key: "review", label: "بازبینی", icon: Check },
] as const
type StepKey = (typeof STEPS)[number]["key"]

function Section({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <section className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
      <h2 className="mb-4 flex items-center gap-2 font-serif text-2xl">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      {children}
    </section>
  )
}

/** Horizontal progress stepper. Past steps are clickable to jump back. */
function Stepper({
  current,
  maxReached,
  onJump,
}: {
  current: number
  maxReached: number
  onJump: (i: number) => void
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="مراحل تسویه">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        const reachable = i <= maxReached
        const Icon = s.icon
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => reachable && onJump(i)}
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                reachable ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-all duration-300",
                  active
                    ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15"
                    : done
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <span
                className={cn(
                  "hidden truncate text-sm sm:block",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  i < current ? "bg-primary/40" : "bg-border"
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

const PAYMENT_LABEL: Record<string, string> = {
  wallet: "کیف پول رومرا",
  bank_transfer: "کارت به کارت / انتقال بانکی",
}

function shippingDays(m?: ShippingMethod) {
  if (!m) return null
  const { min_delivery_days: mn, max_delivery_days: mx } = m
  if (mn && mx) return mn === mx ? `${faNum(mn)} روز کاری` : `${faNum(mn)} تا ${faNum(mx)} روز کاری`
  if (mx) return `تا ${faNum(mx)} روز کاری`
  return null
}

function SelectRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
      )}
    >
      <span className="min-w-0">{children}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
    </button>
  )
}

const PAYMENTS: { value: PaymentMethod; label: string; icon: typeof Wallet }[] = [
  { value: "wallet", label: "کیف پول رومرا", icon: Wallet },
  { value: "bank_transfer", label: "کارت به کارت / انتقال بانکی", icon: Landmark },
]

export function CheckoutFlow() {
  const router = useRouter()
  const { data: cart, isLoading: cartLoading } = useCart()
  const { data: addresses } = useAddresses()
  const shipping = useShippingMethods(SHIP_REGION, 0)
  const validateCoupon = useValidateCoupon()
  const placeOrder = usePlaceOrder()

  const [addressId, setAddressId] = React.useState<number>()
  const [adding, setAdding] = React.useState(false)
  const [shippingId, setShippingId] = React.useState<number>()
  const [payment, setPayment] = React.useState<PaymentMethod>("wallet")
  const [couponCode, setCouponCode] = React.useState("")
  const [coupon, setCoupon] = React.useState<CouponValidation>()

  // Wizard navigation. `maxReached` keeps already-visited steps clickable.
  const [step, setStep] = React.useState(0)
  const [maxReached, setMaxReached] = React.useState(0)
  const goTo = React.useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, i))
    setStep(clamped)
    setMaxReached((m) => Math.max(m, clamped))
  }, [])

  // Gift mode
  const [isGift, setIsGift] = React.useState(false)
  const [giftMessage, setGiftMessage] = React.useState("")
  const [giftWrap, setGiftWrap] = React.useState(false)
  const [hidePrice, setHidePrice] = React.useState(true)
  const [deliveryDate, setDeliveryDate] = React.useState("")

  // Default to the user's default address once it loads. Render-time sync (the
  // same pattern as recipe-filters) — the guard flips false after the first set,
  // so it can't loop, and it avoids a setState-in-effect cascade.
  if (addressId === undefined && addresses?.length) {
    setAddressId((addresses.find((a) => a.is_default) ?? addresses[0]).id)
  }

  const subtotal = cart?.summary.subtotal ?? 0
  const selectedShipping = shipping.data?.find((m) => m.id === shippingId)
  const discount = coupon?.is_valid ? coupon.discount_amount : 0
  const shippingCost = coupon?.free_shipping ? 0 : selectedShipping?.estimated_cost ?? 0
  const total = Math.max(0, subtotal - discount + shippingCost)
  const canPlace = !!addressId && !!shippingId && !!cart?.items.length

  const selectedAddress = addresses?.find((a) => a.id === addressId)
  const currentKey: StepKey = STEPS[step].key
  // Whether the user may advance past the current step.
  const stepValid =
    currentKey === "address"
      ? !!addressId
      : currentKey === "shipping"
        ? !!shippingId
        : true

  function applyCoupon() {
    if (!couponCode.trim()) return
    validateCoupon.mutate(
      { code: couponCode.trim(), order_subtotal: subtotal },
      {
        onSuccess: (res) => {
          setCoupon(res)
          if (!res.is_valid) toast.error(res.invalid_reason || "کد تخفیف معتبر نیست")
          else toast.success("کد تخفیف اعمال شد")
        },
        onError: () => toast.error("کد تخفیف یافت نشد"),
      }
    )
  }

  function submit() {
    if (!canPlace) return
    placeOrder.mutate(
      {
        address_id: addressId!,
        shipping_method_id: shippingId!,
        payment_method: payment,
        coupon_code: coupon?.is_valid ? coupon.coupon.Code : undefined,
        ...(isGift
          ? {
              is_gift: true,
              gift_message: giftMessage.trim() || undefined,
              gift_wrap: giftWrap,
              hide_price: hidePrice,
              scheduled_delivery_date: deliveryDate
                ? new Date(deliveryDate).toISOString()
                : undefined,
            }
          : {}),
      },
      {
        onSuccess: (order) => {
          toast.success("سفارش ثبت شد")
          router.push(`/checkout/confirmation/${order.id}`)
        },
        onError: (e) => {
          const code = e instanceof ApiClientError ? e.code : ""
          toast.error(
            code === "OUT_OF_STOCK"
              ? "موجودی برخی اقلام کافی نیست"
              : code.includes("COUPON")
                ? "کد تخفیف معتبر نیست"
                : "ثبت سفارش ناموفق بود"
          )
        },
      }
    )
  }

  if (cartLoading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="border-hairline mt-8 flex flex-col items-center rounded-2xl bg-card/40 px-6 py-14 text-center">
        <p className="font-medium">سبد خرید شما خالی است</p>
        <Button asChild className="mt-5">
          <Link href="/products">رفتن به فروشگاه</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-6">
        {/* Progress stepper */}
        <div className="border-hairline rounded-2xl bg-card/80 p-4 backdrop-blur-sm ring-1 ring-foreground/5">
          <Stepper current={step} maxReached={maxReached} onJump={goTo} />
        </div>

        {/* Step 1 — Address */}
        {currentKey === "address" ? (
          <Section icon={MapPin} title="آدرس تحویل">
            <div className="flex flex-col gap-2">
              {addresses?.map((a: Address) => (
                <SelectRow key={a.id} selected={addressId === a.id} onClick={() => setAddressId(a.id)}>
                  <span className="block font-medium">{a.full_name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {a.address_line1}، {a.city}
                  </span>
                </SelectRow>
              ))}
            </div>
            {adding ? (
              <div className="mt-3">
                <AddAddressForm
                  onCreated={(addr) => {
                    setAddressId(addr.id)
                    setAdding(false)
                  }}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> آدرس جدید
              </Button>
            )}
          </Section>
        ) : null}

        {/* Step 2 — Shipping */}
        {currentKey === "shipping" ? (
          <Section icon={Truck} title="روش ارسال">
            {shipping.isLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" aria-hidden />
                ))}
                <span className="sr-only">در حال دریافت روش‌های ارسال…</span>
              </div>
            ) : shipping.data?.length ? (
              <div className="flex flex-col gap-2">
                {shipping.data.map((m) => (
                  <SelectRow key={m.id} selected={shippingId === m.id} onClick={() => setShippingId(m.id)}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium">{m.name}</span>
                        {shippingDays(m) ? (
                          <span className="block text-xs text-muted-foreground">{shippingDays(m)}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-muted-foreground">
                        {m.estimated_cost > 0 ? formatPrice(m.estimated_cost) : "رایگان"}
                      </span>
                    </span>
                  </SelectRow>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">روش ارسالی برای منطقهٔ شما یافت نشد.</p>
            )}
          </Section>
        ) : null}

        {/* Step 3 — Payment + Coupon + Gift */}
        {currentKey === "payment" ? (
          <>
            <Section icon={Wallet} title="روش پرداخت">
              <div className="flex flex-col gap-2">
                {PAYMENTS.map((p) => (
                  <SelectRow key={p.value} selected={payment === p.value} onClick={() => setPayment(p.value)}>
                    <span className="flex items-center gap-2 font-medium">
                      <p.icon className="size-4 text-muted-foreground" /> {p.label}
                    </span>
                  </SelectRow>
                ))}
              </div>
            </Section>

            <Section icon={Tag} title="کد تخفیف">
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      applyCoupon()
                    }
                  }}
                  placeholder="کد تخفیف را وارد کنید"
                  dir="ltr"
                  aria-label="کد تخفیف"
                  className="max-w-xs"
                />
                <Button variant="outline" onClick={applyCoupon} disabled={validateCoupon.isPending}>
                  {validateCoupon.isPending ? <Loader2 className="animate-spin" /> : null} اعمال
                </Button>
              </div>
              {coupon?.is_valid ? (
                <p className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" /> تخفیف اعمال‌شده: {formatPrice(coupon.discount_amount)}
                </p>
              ) : null}
            </Section>

            <Section icon={Gift} title="ارسال به‌عنوان هدیه">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">این سفارش یک هدیه است</span>
                <Switch checked={isGift} onCheckedChange={setIsGift} aria-label="حالت هدیه" />
              </label>

              {isGift ? (
                <div className="mt-5 flex flex-col gap-5 border-t border-border/60 pt-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gift_message">پیام هدیه (اختیاری)</Label>
                    <Textarea
                      id="gift_message"
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value.slice(0, 500))}
                      placeholder="یادداشتی برای گیرنده بنویسید…"
                      rows={3}
                    />
                  </div>

                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox checked={giftWrap} onCheckedChange={(v) => setGiftWrap(v === true)} />
                    <span className="text-sm">بسته‌بندی هدیه</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3">
                    <Checkbox checked={hidePrice} onCheckedChange={(v) => setHidePrice(v === true)} />
                    <span className="text-sm">مخفی‌کردن قیمت در رسید بسته</span>
                  </label>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="delivery_date">تاریخ ترجیحی تحویل (اختیاری)</Label>
                    <Input
                      id="delivery_date"
                      type="date"
                      dir="ltr"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                </div>
              ) : null}
            </Section>
          </>
        ) : null}

        {/* Step 4 — Review */}
        {currentKey === "review" ? (
          <Section icon={Check} title="بازبینی و تأیید">
            <dl className="divide-y divide-border/60">
              <ReviewRow icon={MapPin} label="آدرس تحویل" onEdit={() => goTo(0)}>
                {selectedAddress ? (
                  <>
                    <span className="block font-medium text-foreground">{selectedAddress.full_name}</span>
                    <span className="block">
                      {selectedAddress.address_line1}، {selectedAddress.city}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </ReviewRow>
              <ReviewRow icon={Truck} label="روش ارسال" onEdit={() => goTo(1)}>
                <span className="text-foreground">{selectedShipping?.name ?? "—"}</span>
                {shippingDays(selectedShipping) ? (
                  <span className="block text-xs">{shippingDays(selectedShipping)}</span>
                ) : null}
              </ReviewRow>
              <ReviewRow icon={Wallet} label="روش پرداخت" onEdit={() => goTo(2)}>
                <span className="text-foreground">{PAYMENT_LABEL[payment] ?? payment}</span>
              </ReviewRow>
              {isGift ? (
                <ReviewRow icon={Gift} label="هدیه" onEdit={() => goTo(2)}>
                  <span className="text-foreground">این سفارش به‌عنوان هدیه ارسال می‌شود</span>
                  {giftMessage ? <span className="mt-0.5 block">«{giftMessage}»</span> : null}
                </ReviewRow>
              ) : null}
            </dl>

            <ul className="mt-5 divide-y divide-border/60 border-t border-border/60">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.product_title}</span>
                    <span className="text-xs text-muted-foreground">
                      {faNum(item.quantity)} × {formatPrice(item.line_total / item.quantity)}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{formatPrice(item.line_total)}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Step navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => goTo(step - 1)}
            disabled={step === 0 || placeOrder.isPending}
            className={cn(step === 0 && "invisible")}
          >
            <ChevronRight className="size-4" /> مرحلهٔ قبل
          </Button>

          {currentKey === "review" ? (
            <Button
              size="lg"
              className="h-12 min-w-44"
              disabled={!canPlace || placeOrder.isPending}
              onClick={submit}
            >
              {placeOrder.isPending ? <Loader2 className="animate-spin" /> : <Lock className="size-4" />} ثبت و پرداخت
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-12 min-w-36"
              disabled={!stepValid}
              onClick={() => goTo(step + 1)}
            >
              ادامه <ChevronLeft className="size-4" />
            </Button>
          )}
        </div>

        {currentKey !== "review" && !stepValid ? (
          <p className="-mt-3 text-center text-xs text-muted-foreground">
            {currentKey === "address" ? "یک آدرس تحویل انتخاب کنید." : "یک روش ارسال انتخاب کنید."}
          </p>
        ) : null}
      </div>

      {/* Summary rail (sticky desktop) */}
      <aside className="h-fit lg:sticky lg:top-24">
        <div className="border-hairline shadow-e2 relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
          <div aria-hidden className="rule-gold absolute inset-x-6 top-0" />
          <h2 className="font-serif text-2xl">خلاصهٔ سفارش</h2>
          <div className="mt-4 space-y-2 text-sm">
            <Row label={`جمع جزء (${faNum(cart.summary.total_items)} قلم)`} value={formatPrice(subtotal)} />
            {discount > 0 ? <Row label="تخفیف" value={`− ${formatPrice(discount)}`} accent /> : null}
            <Row
              label="ارسال"
              value={
                selectedShipping || shippingCost > 0
                  ? shippingCost > 0
                    ? formatPrice(shippingCost)
                    : "رایگان"
                  : "—"
              }
            />
          </div>
          <Separator className="my-4" />
          <div className="flex items-baseline justify-between">
            <span className="font-medium">مبلغ قابل پرداخت</span>
            <span className="font-serif text-2xl text-foil tabular-nums">{formatPrice(total)}</span>
          </div>

          {/* Primary place-order CTA also lives here for the final step */}
          {currentKey === "review" ? (
            <Button
              size="lg"
              className="mt-6 h-12 w-full"
              disabled={!canPlace || placeOrder.isPending}
              onClick={submit}
            >
              {placeOrder.isPending ? <Loader2 className="animate-spin" /> : <Lock className="size-4" />} ثبت و پرداخت
            </Button>
          ) : null}

          <ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" /> پرداخت امن و رمزگذاری‌شده
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 shrink-0 text-primary" /> ارسال محتاطانه و بسته‌بندی محافظت‌شده
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

function ReviewRow({
  icon: Icon,
  label,
  onEdit,
  children,
}: {
  icon: typeof MapPin
  label: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm text-muted-foreground">{children}</dd>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs text-primary" onClick={onEdit}>
        ویرایش
      </Button>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(accent && "text-emerald-500")}>{value}</span>
    </div>
  )
}
