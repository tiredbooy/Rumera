"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, Check, MapPin, Truck, Tag, Wallet, Landmark, Gift } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatPrice, faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  useCart,
  useAddresses,
  useShippingMethods,
  useValidateCoupon,
  usePlaceOrder,
} from "@/lib/api/hooks"
import type { Address, CouponValidation, PaymentMethod } from "@/lib/catalog/types"
import { ApiClientError } from "@/lib/api/store-client"
import { AddAddressForm } from "./add-address-form"

const SHIP_REGION = "IR"

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
        coupon_code: coupon?.is_valid ? coupon.coupon.code : undefined,
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
        {/* Address */}
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

        {/* Shipping */}
        <Section icon={Truck} title="روش ارسال">
          {shipping.isLoading ? (
            <div className="py-4 text-sm text-muted-foreground">در حال دریافت روش‌های ارسال…</div>
          ) : shipping.data?.length ? (
            <div className="flex flex-col gap-2">
              {shipping.data.map((m) => (
                <SelectRow key={m.id} selected={shippingId === m.id} onClick={() => setShippingId(m.id)}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-sm text-muted-foreground">
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

        {/* Coupon */}
        <Section icon={Tag} title="کد تخفیف">
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="کد تخفیف را وارد کنید"
              dir="ltr"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={applyCoupon} disabled={validateCoupon.isPending}>
              {validateCoupon.isPending ? <Loader2 className="animate-spin" /> : null} اعمال
            </Button>
          </div>
          {coupon?.is_valid ? (
            <p className="mt-2 text-sm text-emerald-500">
              تخفیف اعمال‌شده: {formatPrice(coupon.discount_amount)}
            </p>
          ) : null}
        </Section>

        {/* Payment */}
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

        {/* Gift */}
        <Section icon={Gift} title="ارسال به‌عنوان هدیه">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              این سفارش یک هدیه است
            </span>
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
      </div>

      {/* Summary */}
      <aside className="h-fit lg:sticky lg:top-24">
        <div className="border-hairline rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
          <h2 className="font-serif text-2xl">خلاصهٔ سفارش</h2>
          <div className="mt-4 space-y-2 text-sm">
            <Row label={`جمع جزء (${faNum(cart.summary.total_items)} قلم)`} value={formatPrice(subtotal)} />
            {discount > 0 ? <Row label="تخفیف" value={`− ${formatPrice(discount)}`} accent /> : null}
            <Row label="ارسال" value={shippingCost > 0 ? formatPrice(shippingCost) : "رایگان"} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="font-medium">مبلغ قابل پرداخت</span>
            <span className="font-serif text-2xl text-foil">{formatPrice(total)}</span>
          </div>
          <Button size="lg" className="mt-6 h-12 w-full" disabled={!canPlace || placeOrder.isPending} onClick={submit}>
            {placeOrder.isPending ? <Loader2 className="animate-spin" /> : null} ثبت سفارش
          </Button>
          {!canPlace ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              آدرس و روش ارسال را انتخاب کنید.
            </p>
          ) : null}
        </div>
      </aside>
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
