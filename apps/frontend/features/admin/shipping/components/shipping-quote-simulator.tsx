"use client";

import * as React from "react";
import { Calculator, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardErrorState } from "@/features/dashboard/components/async-state";
import { useShippingMethods } from "@/features/shipping/api";
import { faNum, formatPrice } from "@/lib/products";

const RATE_TYPE_FA: Record<string, string> = {
  flat_rate: "مبلغ ثابت",
  per_kg: "به‌ازای کیلو",
  percentage: "درصد سفارش",
  free: "رایگان",
};

/**
 * Operator tool: calls the same public quote endpoint checkout uses so admins
 * can verify region + weight + subtotal against authoritative backend rates.
 */
export function ShippingQuoteSimulator({
  defaultRegion = "",
}: {
  defaultRegion?: string;
}) {
  const [region, setRegion] = React.useState(defaultRegion);
  const [weight, setWeight] = React.useState("1.5");
  const [subtotal, setSubtotal] = React.useState("2000000");
  const [submitted, setSubmitted] = React.useState<{
    region: string;
    weight: number;
    subtotal: number;
  } | null>(null);

  const query = useShippingMethods(
    submitted?.region ?? "",
    submitted?.weight ?? 0,
    submitted?.subtotal ?? 0,
    Boolean(submitted),
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const regionCode = region.trim().toUpperCase();
    const weightKg = Number(weight);
    const subtotalAmount = Number(subtotal);
    if (
      !regionCode ||
      !Number.isFinite(weightKg) ||
      weightKg < 0 ||
      !Number.isFinite(subtotalAmount) ||
      subtotalAmount < 0
    ) {
      return;
    }
    setSubmitted({
      region: regionCode,
      weight: weightKg,
      subtotal: subtotalAmount,
    });
  }

  return (
    <section
      aria-labelledby="shipping-quote-sim-title"
      className="border-hairline mt-8 max-w-5xl rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
    >
      <div className="mb-4 flex items-start gap-3">
        <Calculator className="mt-0.5 size-5 text-primary" aria-hidden />
        <div>
          <h2
            id="shipping-quote-sim-title"
            className="font-serif text-lg text-foreground"
          >
            شبیه‌ساز هزینهٔ ارسال
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            همان API تسویه حساب (`/shipping/available`) فراخوانی می‌شود — نه
            تخمین محلی. منطقه باید با یکی از کدهای پوشش منطقهٔ فعال جور باشد.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-3 sm:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sim-region">کد منطقه</Label>
          <Input
            id="sim-region"
            dir="ltr"
            className="font-mono"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="IR-TEH"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sim-weight">وزن بسته (کیلوگرم)</Label>
          <Input
            id="sim-weight"
            type="number"
            min={0}
            step="0.01"
            dir="ltr"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sim-subtotal">مبلغ سبد (تومان)</Label>
          <Input
            id="sim-subtotal"
            type="number"
            min={0}
            step="1"
            dir="ltr"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" className="min-h-10">
            محاسبه از سرور
          </Button>
        </div>
      </form>

      {submitted ? (
        <div className="mt-5">
          {query.isLoading ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              در حال دریافت نرخ‌ها…
            </p>
          ) : null}

          {query.isError ? (
            <DashboardErrorState
              title="دریافت نرخ ارسال ناموفق بود"
              description="API در دسترس نیست یا پارامترها نامعتبرند. اتصال را بررسی کنید."
              onRetry={() => void query.refetch()}
              isRetrying={query.isFetching}
              className="min-h-32"
            />
          ) : null}

          {query.isSuccess && query.data.length === 0 ? (
            <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              برای این منطقه/وزن هیچ روش فعالی برنگشت. کد پوشش، فعال بودن منطقه
              و محدودیت وزن روش‌ها را بررسی کنید.
            </p>
          ) : null}

          {query.isSuccess && query.data.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>روش</TableHead>
                    <TableHead>نوع نرخ</TableHead>
                    <TableHead>حامل</TableHead>
                    <TableHead className="text-end">هزینهٔ تخمینی</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">
                        {method.name}
                        {!method.is_active ? (
                          <span className="ms-2 text-xs text-muted-foreground">
                            (غیرفعال)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {RATE_TYPE_FA[method.rate_type] ?? method.rate_type}
                      </TableCell>
                      <TableCell>{method.carrier ?? "—"}</TableCell>
                      <TableCell className="text-end font-serif">
                        {formatPrice(method.estimated_cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
                نمونه: منطقه {submitted.region} · وزن {faNum(submitted.weight)}{" "}
                کیلو · سبد {formatPrice(submitted.subtotal)}
                {query.isFetching ? (
                  <span className="ms-2 inline-flex items-center gap-1">
                    <RotateCw className="size-3 animate-spin" aria-hidden />
                    به‌روز…
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
