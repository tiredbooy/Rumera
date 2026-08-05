"use client";

import { faNum, formatPrice } from "@/lib/products";
import type { ShippingRateType } from "@/features/shipping/types";

const SAMPLE_SUBTOTAL = 2_000_000;
const SAMPLE_WEIGHT_KG = 2;

function parseLooseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lightweight client-side estimate so admins can sanity-check rate rules
 * without placing a real order. Mirrors the policy semantics at a high level.
 */
export function estimateSampleShippingCost(input: {
  rateType: ShippingRateType;
  baseRate: string;
  freeAboveAmount: string;
  subtotal?: number;
  weightKg?: number;
}): { cost: number | null; note: string } {
  const subtotal = input.subtotal ?? SAMPLE_SUBTOTAL;
  const weight = input.weightKg ?? SAMPLE_WEIGHT_KG;
  const base = parseLooseNumber(input.baseRate);
  const freeAbove = parseLooseNumber(input.freeAboveAmount);

  if (input.rateType === "free") {
    return { cost: 0, note: "این روش همیشه رایگان است." };
  }

  if (
    freeAbove != null &&
    freeAbove > 0 &&
    subtotal >= freeAbove
  ) {
    return {
      cost: 0,
      note: `با سبد نمونه (${formatPrice(subtotal)}) از آستانهٔ رایگان عبور می‌کند.`,
    };
  }

  if (base == null || base < 0) {
    return { cost: null, note: "نرخ را وارد کنید تا پیش‌نمایش ساخته شود." };
  }

  switch (input.rateType) {
    case "flat_rate":
      return {
        cost: base,
        note: `سبد نمونه ${formatPrice(subtotal)} · وزن ${faNum(weight)} کیلو`,
      };
    case "per_kg":
      return {
        cost: base * weight,
        note: `${formatPrice(base)} × ${faNum(weight)} کیلو (نمونه)`,
      };
    case "percentage":
      return {
        cost: (subtotal * base) / 100,
        note: `${faNum(base)}٪ از سبد نمونه ${formatPrice(subtotal)}`,
      };
    default:
      return { cost: null, note: "" };
  }
}

export function ShippingCostPreview({
  rateType,
  baseRate,
  freeAboveAmount,
}: {
  rateType: ShippingRateType;
  baseRate: string;
  freeAboveAmount: string;
}) {
  const { cost, note } = estimateSampleShippingCost({
    rateType,
    baseRate,
    freeAboveAmount,
  });

  return (
    <div className="sm:col-span-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-primary">
        پیش‌نمایش هزینه (نمونه)
      </p>
      <p className="mt-1 font-serif text-2xl text-foreground">
        {cost == null ? "—" : formatPrice(cost)}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        این عدد فقط راهنماست؛ مبلغ نهایی در سفارش با وزن و مبلغ واقعی محاسبه
        می‌شود.
      </p>
    </div>
  );
}
