import { faNum, formatPrice } from "@/lib/products";
import { toAsciiDigits } from "@/lib/normalize-digits";

import type { DiscountType } from "@/features/coupons/types";

export function parseCouponNumber(value: string): number | undefined {
  const trimmed = toAsciiDigits(value).trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
}

export function couponMoneyHint(value: string): string | null {
  const number = parseCouponNumber(value);
  if (number == null || number < 0) return null;
  return formatPrice(number);
}

export function summarizeCouponOffer({
  discountType,
  discountValue,
  maxDiscountAmount,
  minOrderAmount,
}: {
  discountType: DiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
}): string {
  const minOrder = parseCouponNumber(minOrderAmount);
  const minClause =
    minOrder != null && minOrder > 0
      ? ` برای سفارش‌های بالای ${formatPrice(minOrder)}`
      : "";

  if (discountType === "free_shipping") {
    return minClause
      ? `ارسال رایگان${minClause}`
      : "ارسال رایگان بدون حداقل سفارش";
  }

  if (discountType === "percentage") {
    const percent = parseCouponNumber(discountValue);
    if (percent == null) return "";
    const cap = parseCouponNumber(maxDiscountAmount);
    const capClause =
      cap != null && cap > 0 ? ` تا سقف ${formatPrice(cap)}` : "";
    return `${faNum(percent)}٪ تخفیف${capClause}${minClause}`;
  }

  const amount = parseCouponNumber(discountValue);
  if (amount == null) return "";
  return `${formatPrice(amount)} تخفیف${minClause}`;
}
