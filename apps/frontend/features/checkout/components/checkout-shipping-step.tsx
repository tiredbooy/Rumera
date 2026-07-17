import { Loader2, RefreshCw, Truck } from "lucide-react";

import { QueryStateRegion } from "@/components/query-state-region";
import { Button } from "@/components/ui/button";
import type { ShippingMethod } from "@/features/shipping/types";
import { formatPrice } from "@/lib/products";
import {
  CheckoutChoiceGroup,
  CheckoutSection,
  CheckoutSelectRow,
  shippingDays,
} from "./checkout-step-presentation";

export function CheckoutShippingStep({
  methods,
  isLoading,
  isError,
  isRetrying,
  shippingId,
  onRetry,
  onSelectShipping,
}: {
  methods?: ShippingMethod[];
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  shippingId?: number;
  onRetry: () => void;
  onSelectShipping: (shippingId: number) => void;
}) {
  const unavailable = isError && methods === undefined;

  return (
    <CheckoutSection icon={Truck} title="روش ارسال">
      {isLoading ? (
        <QueryStateRegion
          state="loading"
          aria-label="در حال دریافت روش‌های ارسال"
          className="flex flex-col gap-2"
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-muted/50"
              aria-hidden
            />
          ))}
          <span className="sr-only">در حال دریافت روش‌های ارسال…</span>
        </QueryStateRegion>
      ) : unavailable ? (
        <QueryStateRegion
          state="error"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p>دریافت روش‌های ارسال انجام نشد.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isRetrying}
            onClick={onRetry}
          >
            {isRetrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            تلاش دوباره
          </Button>
        </QueryStateRegion>
      ) : (
        <>
          {isError ? (
            <QueryStateRegion
              state="error"
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <span>تازه‌سازی روش‌های ارسال انجام نشد؛ اطلاعات قبلی نمایش داده می‌شود.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRetrying}
                onClick={onRetry}
              >
                {isRetrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                تلاش دوباره
              </Button>
            </QueryStateRegion>
          ) : null}

          {methods?.length ? (
            <CheckoutChoiceGroup label="انتخاب روش ارسال">
              {methods.map((m) => (
                <CheckoutSelectRow
                  key={m.id}
                  name="checkout-shipping"
                  value={String(m.id)}
                  selected={shippingId === m.id}
                  onClick={() => onSelectShipping(m.id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{m.name}</span>
                      {shippingDays(m) ? (
                        <span className="block text-xs text-muted-foreground">
                          {shippingDays(m)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-muted-foreground">
                      {m.estimated_cost > 0
                        ? formatPrice(m.estimated_cost)
                        : "رایگان"}
                    </span>
                  </span>
                </CheckoutSelectRow>
              ))}
            </CheckoutChoiceGroup>
          ) : (
            <p className="text-sm text-muted-foreground">
              روش ارسالی برای منطقهٔ شما یافت نشد.
            </p>
          )}
        </>
      )}
    </CheckoutSection>
  );
}
