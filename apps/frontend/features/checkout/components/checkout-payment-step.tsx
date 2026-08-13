import { Check, Gift, Landmark, Loader2, Tag, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const PAYMENTS: { value: PaymentMethod; label: string; icon: typeof Wallet }[] =
  [
    { value: "wallet", label: "کیف پول رومرا", icon: Wallet },
    {
      value: "bank_transfer",
      label: "کارت به کارت / انتقال بانکی",
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
}) {
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
              <span className="flex items-center gap-2 font-medium">
                <p.icon className="size-4 text-muted-foreground" /> {p.label}
              </span>
            </CheckoutSelectRow>
          ))}
        </CheckoutChoiceGroup>
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
          <p id="coupon-success" className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
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
              <Input
                id="delivery_date"
                type="date"
                dir="ltr"
                value={deliveryDate}
                onChange={(e) => onDeliveryDateChange(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        ) : null}
      </CheckoutSection>
      ) : null}
    </>
  );
}
