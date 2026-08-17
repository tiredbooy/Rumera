import Link from "next/link";
import { Award, Check, Gift, Landmark, Loader2, Tag, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CouponValidation } from "@/features/coupons/types";
import type { PaymentMethod } from "@/features/orders/types";
import type { GiftCheckoutSettings } from "@/features/settings/types";
import { formatPrice } from "@/lib/products";
import {
  CheckoutChoiceGroup,
  CheckoutSection,
  CheckoutSelectRow,
} from "./checkout-step-presentation";

// PR-030c: place-order response has no payment_url (PR-020f). This step
// only picks a method. Do not invent a gateway start URL here.
// PR-030d: no IBAN / account-number API. Bank transfer is offline;
// the order stays pending until staff mark paid. Do not invent numbers
// or imply instant pay / already-confirmed. Wallet can settle on
// place-order (PR-020a) — do not describe it as operator-wait.
const BANK_TRANSFER_HINT =
  "واریز را بیرون از سایت انجام دهید. شمارهٔ شبا یا حساب در این صفحه نیست و سفارش تا ثبت پرداخت توسط کارکنان در انتظار می‌ماند.";

const PAYMENTS: {
  value: PaymentMethod;
  label: string;
  hint?: string;
  icon: typeof Wallet;
}[] = [
  { value: "wallet", label: "کیف پول رومرا", icon: Wallet },
  {
    value: "bank_transfer",
    label: "کارت به کارت / انتقال بانکی",
    hint: BANK_TRANSFER_HINT,
    icon: Landmark,
  },
];

export function CheckoutPaymentStep({
  payment,
  onPaymentChange,
  couponCode,
  onCouponCodeChange,
  onApplyCoupon,
  couponPending,
  coupon,
  couponError,
  couponNotice,
  isGift,
  onGiftChange,
  giftMessage,
  onGiftMessageChange,
  giftOptionIds,
  onToggleGiftOption,
  giftSettings,
  hidePrice,
  onHidePriceChange,
  deliveryDate,
  onDeliveryDateChange,
  walletBalance,
  total,
}: {
  payment: PaymentMethod;
  onPaymentChange: (payment: PaymentMethod) => void;
  couponCode: string;
  onCouponCodeChange: (code: string) => void;
  onApplyCoupon: () => void;
  couponPending: boolean;
  coupon?: CouponValidation;
  couponError?: string;
  couponNotice?: string;
  isGift: boolean;
  onGiftChange: (isGift: boolean) => void;
  giftMessage: string;
  onGiftMessageChange: (message: string) => void;
  giftOptionIds: string[];
  onToggleGiftOption: (id: string, selected: boolean) => void;
  giftSettings: GiftCheckoutSettings | null;
  hidePrice: boolean;
  onHidePriceChange: (hidePrice: boolean) => void;
  deliveryDate: string;
  onDeliveryDateChange: (date: string) => void;
  /** null/undefined = not known (guest, or the wallet request failed). */
  walletBalance?: number | null;
  total?: number;
}) {
  // U-1: wallet is the preselected method and the balance was never shown, so
  // the first thing a customer with an empty wallet learned was a 409 at submit,
  // after filling in the whole checkout.
  //
  // Only ever claim a shortfall, never sufficiency: `total` is the client-side
  // figure and the server adds tax on top (orders/service.go), so this is a lower
  // bound on what the wallet must cover. Short here means definitely short; not
  // short here still has to clear the server.
  const walletShortfall =
    walletBalance != null && total != null && walletBalance < total
      ? total - walletBalance
      : null;

  const giftEnabled = giftSettings?.enabled !== false;
  const enabledOptions = (giftSettings?.options ?? []).filter((o) => o.enabled);
  const maxMsg = giftSettings?.messageMaxLength || 500;
  const couponDescriptionIds = [
    coupon?.is_valid ? "coupon-success" : undefined,
    couponError ? "coupon-error" : undefined,
    couponNotice ? "coupon-notice" : undefined,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <>
      <CheckoutSection icon={Wallet} title="روش پرداخت">
        <CheckoutChoiceGroup label="روش پرداخت">
          {PAYMENTS.map((p) => (
            <CheckoutSelectRow
              key={p.value}
              name="checkout-payment"
              value={p.value}
              selected={payment === p.value}
              onClick={() => onPaymentChange(p.value)}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium">
                  <p.icon className="size-4 text-muted-foreground" /> {p.label}
                </span>
                {p.value === "wallet" && walletBalance != null ? (
                  <span
                    className="mt-1 block text-xs text-muted-foreground"
                    data-testid="checkout-wallet-balance"
                  >
                    موجودی: {formatPrice(walletBalance)}
                  </span>
                ) : null}
                {p.hint ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p.hint}
                  </span>
                ) : null}
              </span>
            </CheckoutSelectRow>
          ))}
        </CheckoutChoiceGroup>
        {walletShortfall != null ? (
          <div
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            data-testid="checkout-wallet-shortfall"
          >
            <p className="text-xs leading-relaxed text-destructive">
              موجودی کیف پول برای این سفارش کافی نیست — دست‌کم{" "}
              {formatPrice(walletShortfall)} کم دارید. کیف پول را شارژ کنید یا
              روش دیگری را انتخاب کنید.
            </p>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-2 h-8"
              data-testid="checkout-wallet-topup-cta"
            >
              <Link href="/account/wallet">شارژ کیف پول</Link>
            </Button>
          </div>
        ) : null}
      </CheckoutSection>

      <CheckoutSection icon={Tag} title="کد تخفیف">
        <div className="flex gap-2">
          <Input
            id="coupon-code"
            value={couponCode}
            onChange={(e) => onCouponCodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApplyCoupon();
              }
            }}
            placeholder="کد تخفیف را وارد کنید"
            dir="ltr"
            aria-label="کد تخفیف"
            aria-invalid={!!couponError}
            aria-describedby={couponDescriptionIds}
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onApplyCoupon}
            disabled={couponPending}
          >
            {couponPending ? <Loader2 className="animate-spin" /> : null} اعمال
          </Button>
        </div>
        {coupon?.is_valid ? (
          <p id="coupon-success" className="mt-2 inline-flex items-center gap-1 text-sm text-success">
            <Check className="size-4" /> تخفیف اعمال‌شده:{" "}
            {formatPrice(coupon.discount_amount)}
          </p>
        ) : null}
        {couponError ? (
          <p id="coupon-error" role="alert" className="mt-2 text-sm text-destructive">
            {couponError}
          </p>
        ) : null}
        {couponNotice ? (
          <p id="coupon-notice" role="status" className="mt-2 text-sm text-muted-foreground">
            {couponNotice}
          </p>
        ) : null}
      </CheckoutSection>

      {giftEnabled ? (
      <CheckoutSection icon={Gift} title="ارسال به‌عنوان هدیه">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            این سفارش یک هدیه است
          </span>
          <Switch
            checked={isGift}
            onCheckedChange={onGiftChange}
            aria-label="حالت هدیه"
          />
        </label>

        {isGift ? (
          <div className="mt-5 flex flex-col gap-5 border-t border-border/60 pt-5">
            {giftSettings?.messageEnabled !== false ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="gift_message">پیام هدیه (اختیاری)</Label>
              <Textarea
                id="gift_message"
                value={giftMessage}
                onChange={(e) =>
                  onGiftMessageChange(e.target.value.slice(0, maxMsg))
                }
                placeholder="یادداشتی برای گیرنده بنویسید…"
                rows={3}
              />
            </div>
            ) : null}

            {enabledOptions.length > 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">بسته‌بندی و افزونه‌ها</p>
                <ul className="space-y-2">
                  {enabledOptions.map((opt) => {
                    const selected = giftOptionIds.includes(opt.id);
                    return (
                      <li key={opt.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/40">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) =>
                              onToggleGiftOption(opt.id, v === true)
                            }
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-sm font-medium">
                                {opt.label}
                              </span>
                              <span className="text-sm tabular-nums text-primary">
                                {opt.price > 0
                                  ? formatPrice(opt.price)
                                  : "رایگان"}
                              </span>
                            </span>
                            {opt.description ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {opt.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {giftSettings?.hidePriceEnabled !== false ? (
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox
                checked={hidePrice}
                onCheckedChange={(v) => onHidePriceChange(v === true)}
              />
              <span className="text-sm">مخفی‌کردن قیمت در رسید بسته</span>
            </label>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery_date">
                تاریخ ترجیحی تحویل (اختیاری)
              </Label>
              <JalaliDateTimeInput
                id="delivery_date"
                value={deliveryDate}
                onChange={onDeliveryDateChange}
                className="max-w-xs"
              />
            </div>
          </div>
        ) : null}
      </CheckoutSection>
      ) : null}

      <CheckoutSection icon={Award} title="باشگاه مشتریان">
        <p className="text-sm text-muted-foreground">
          امتیاز باشگاه (در صورت تعلق) پس از{" "}
          <strong className="font-medium text-foreground">تأیید پرداخت</strong>{" "}
          محاسبه می‌شود — ثبت سفارش به‌تنهایی امتیاز نمی‌دهد.
        </p>
        <Button asChild variant="link" className="mt-2 h-auto px-0">
          <Link href="/account/rewards">مشاهدهٔ باشگاه مشتریان</Link>
        </Button>
      </CheckoutSection>
    </>
  );
}
