"use client";

import { cn } from "@/lib/utils";
import type { ShippingRateType } from "@/features/shipping/types";

const RATE_OPTIONS: {
  value: ShippingRateType;
  title: string;
  description: string;
  example: string;
}[] = [
  {
    value: "flat_rate",
    title: "مبلغ ثابت",
    description: "یک هزینهٔ ثابت برای هر سفارش در این منطقه.",
    example: "مثلاً همیشه ۱۵۰٬۰۰۰ تومان",
  },
  {
    value: "per_kg",
    title: "به‌ازای وزن",
    description: "نرخ × وزن بسته (کیلوگرم). مناسب بسته‌های سنگین.",
    example: "مثلاً ۵۰٬۰۰۰ تومان برای هر کیلو",
  },
  {
    value: "percentage",
    title: "درصد از سفارش",
    description: "درصدی از مبلغ کالاها (قبل از ارسال).",
    example: "مثلاً ۳٪ از مبلغ سبد",
  },
  {
    value: "free",
    title: "همیشه رایگان",
    description: "هزینه همیشه صفر است؛ آستانهٔ رایگان لازم نیست.",
    example: "مناسب ارسال هدیه یا سیاست ثابت",
  },
];

export function RateTypePicker({
  value,
  onChange,
  disabled = false,
  invalid = false,
  id,
}: {
  value: ShippingRateType;
  onChange: (next: ShippingRateType) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="نوع نرخ ارسال"
      aria-invalid={invalid || undefined}
      className="grid gap-2 sm:col-span-2 sm:grid-cols-2"
    >
      {RATE_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-start transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              active
                ? "border-primary/40 bg-primary/8 ring-1 ring-primary/20"
                : "border-border/80 bg-background hover:border-primary/30 hover:bg-muted/30",
              disabled && "opacity-60",
            )}
          >
            <p className="text-sm font-semibold text-foreground">
              {option.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {option.description}
            </p>
            <p className="mt-2 text-[11px] text-primary/90">{option.example}</p>
          </button>
        );
      })}
    </div>
  );
}
