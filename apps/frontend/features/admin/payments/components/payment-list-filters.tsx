"use client";

import * as React from "react";
import { FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_STATUS_FA } from "@/features/payments/presentation";
import type { PaymentStatus } from "@/features/payments/types";

export type PaymentSort = "newest" | "oldest" | "amount_desc" | "amount_asc";

export function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function paymentStatus(value: string | null): PaymentStatus | undefined {
  return value === "pending" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "refunded" ||
    value === "partially_refunded"
    ? value
    : undefined;
}

export function paymentSort(value: string | null): PaymentSort {
  return value === "oldest" || value === "amount_desc" || value === "amount_asc"
    ? value
    : "newest";
}

export function PaymentListFilters({
  orderID,
  userID,
  status,
  sort,
  hasFilters,
  onUpdate,
  onReset,
}: {
  orderID?: number;
  userID?: number;
  status?: PaymentStatus;
  sort: PaymentSort;
  hasFilters: boolean;
  onUpdate: (updates: Record<string, string | undefined>) => void;
  onReset: () => void;
}) {
  const [filterError, setFilterError] = React.useState<string | null>(null);

  function applyIDFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawOrder = String(data.get("order") ?? "").trim();
    const rawUser = String(data.get("user") ?? "").trim();
    if (rawOrder && !positiveInteger(rawOrder)) {
      setFilterError("شناسهٔ سفارش باید یک عدد صحیح مثبت و معتبر باشد.");
      (form.elements.namedItem("order") as HTMLElement | null)?.focus();
      return;
    }
    if (rawUser && !positiveInteger(rawUser)) {
      setFilterError("شناسهٔ داخلی کاربر باید یک عدد صحیح مثبت و معتبر باشد.");
      (form.elements.namedItem("user") as HTMLElement | null)?.focus();
      return;
    }
    setFilterError(null);
    onUpdate({ order: rawOrder || undefined, user: rawUser || undefined });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="payment-list-title" className="font-serif text-lg">
            دفتر تراکنش‌ها
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            فیلترها مستقیماً روی دادهٔ واقعی پرداخت اعمال می‌شوند.
          </p>
        </div>
        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <FilterX className="size-4" aria-hidden /> پاک کردن فیلترها
          </Button>
        ) : null}
      </div>

      <div className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <form
          key={`${orderID ?? ""}-${userID ?? ""}`}
          onSubmit={applyIDFilters}
          className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <Label htmlFor="payment-order-filter" className="sr-only">
              شناسهٔ سفارش
            </Label>
            <Input
              id="payment-order-filter"
              name="order"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              defaultValue={orderID ?? ""}
              placeholder="شناسهٔ سفارش"
              aria-describedby={
                filterError ? "payment-filter-error" : undefined
              }
              className="h-11"
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="payment-user-filter" className="sr-only">
              شناسهٔ داخلی کاربر
            </Label>
            <Input
              id="payment-user-filter"
              name="user"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              defaultValue={userID ?? ""}
              placeholder="شناسهٔ داخلی کاربر"
              aria-describedby={
                filterError ? "payment-filter-error" : undefined
              }
              className="h-11"
            />
          </div>
          <Button type="submit" variant="outline" className="h-11">
            اعمال شناسه‌ها
          </Button>
        </form>

        <Select
          value={status ?? "all"}
          onValueChange={(value) =>
            onUpdate({ status: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger
            className="h-11 w-full"
            aria-label="فیلتر وضعیت پرداخت"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ وضعیت‌ها</SelectItem>
            {(Object.keys(PAYMENT_STATUS_FA) as PaymentStatus[]).map(
              (value) => (
                <SelectItem key={value} value={value}>
                  {PAYMENT_STATUS_FA[value]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(value) =>
            onUpdate({ sort: value === "newest" ? undefined : value })
          }
        >
          <SelectTrigger className="h-11 w-full" aria-label="ترتیب تراکنش‌ها">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">جدیدترین</SelectItem>
            <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
            <SelectItem value="amount_desc">بیشترین مبلغ</SelectItem>
            <SelectItem value="amount_asc">کمترین مبلغ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterError ? (
        <p
          id="payment-filter-error"
          role="alert"
          className="mb-4 text-sm text-destructive"
        >
          {filterError}
        </p>
      ) : null}
    </>
  );
}
