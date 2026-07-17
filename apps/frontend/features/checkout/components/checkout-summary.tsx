import { Loader2, Lock, ShieldCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { faNum, formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

export function CheckoutSummary({
  totalItems,
  subtotal,
  discount,
  shippingCost,
  hasSelectedShipping,
  total,
  showSubmit,
  canPlace,
  isSubmitting,
  onSubmit,
}: {
  totalItems: number;
  subtotal: number;
  discount: number;
  shippingCost: number;
  hasSelectedShipping: boolean;
  total: number;
  showSubmit: boolean;
  canPlace: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <aside className="h-fit lg:sticky lg:top-24">
      <div className="border-hairline shadow-e2 relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-foreground/5">
        <div aria-hidden className="rule-gold absolute inset-x-6 top-0" />
        <h2 className="font-serif text-2xl">خلاصهٔ سفارش</h2>
        <div className="mt-4 space-y-2 text-sm">
          <Row
            label={`جمع جزء (${faNum(totalItems)} قلم)`}
            value={formatPrice(subtotal)}
          />
          {discount > 0 ? (
            <Row label="تخفیف" value={`− ${formatPrice(discount)}`} accent />
          ) : null}
          <Row
            label="ارسال"
            value={
              hasSelectedShipping || shippingCost > 0
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
          <span className="font-serif text-2xl text-foil tabular-nums">
            {formatPrice(total)}
          </span>
        </div>

        {/* Primary place-order CTA also lives here for the final step */}
        {showSubmit ? (
          <Button
            size="lg"
            className="mt-6 h-12 w-full"
            disabled={!canPlace || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}{" "}
            ثبت و پرداخت
          </Button>
        ) : null}

        <ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0 text-primary" /> پرداخت امن
            و رمزگذاری‌شده
          </li>
          <li className="flex items-center gap-2">
            <Truck className="size-4 shrink-0 text-primary" /> ارسال محتاطانه و
            بسته‌بندی محافظت‌شده
          </li>
        </ul>
      </div>
    </aside>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(accent && "text-emerald-500")}>{value}</span>
    </div>
  );
}
