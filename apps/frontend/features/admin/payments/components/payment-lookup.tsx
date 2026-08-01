"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RotateCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_FA } from "@/features/orders/labels";
import { PaymentApiError } from "@/features/payments/api/admin-client";
import { useAdminPaymentByTransactionID } from "@/features/payments/hooks";
import { formatPaymentAmount } from "@/features/payments/presentation";
import { faDateTime } from "@/lib/utils/date";

import { PaymentStatusBadge } from "./payment-status-badge";

export function PaymentLookup() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState("");
  const [transactionID, setTransactionID] = React.useState("");
  const lookup = useAdminPaymentByTransactionID(
    transactionID,
    transactionID.length > 0,
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    if (!next) {
      inputRef.current?.focus();
      return;
    }
    if (next === transactionID) {
      void lookup.refetch();
      return;
    }
    setTransactionID(next);
  }

  function clear() {
    setValue("");
    setTransactionID("");
    inputRef.current?.focus();
  }

  const missing =
    lookup.error instanceof PaymentApiError && lookup.error.status === 404;

  return (
    <section
      aria-labelledby="payment-lookup-title"
      className="border-hairline rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04] sm:p-5"
    >
      <div className="mb-4">
        <h2 id="payment-lookup-title" className="font-serif text-base">
          تطبیق با شناسهٔ درگاه
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          شناسهٔ تراکنش ثبت‌شده در درگاه یا وب‌هوک را برای بازیابی مستقیم وارد
          کنید.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="flex min-w-0 flex-col gap-2 sm:flex-row"
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="payment-transaction-lookup" className="sr-only">
            شناسهٔ تراکنش درگاه
          </Label>
          <Input
            ref={inputRef}
            id="payment-transaction-lookup"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="برای نمونه ch_3PqR…"
            autoComplete="off"
            dir="ltr"
            className="h-11 font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            className="h-11 flex-1 sm:flex-none"
            disabled={lookup.isFetching || !value.trim()}
          >
            {lookup.isFetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Search className="size-4" aria-hidden />
            )}
            {lookup.isFetching ? "در حال جستجو…" : "جستجو"}
          </Button>
          {transactionID ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="پاک کردن نتیجهٔ جستجو"
              onClick={clear}
              disabled={lookup.isFetching}
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-4" aria-live="polite">
        {lookup.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm"
          >
            <p>
              {missing
                ? "تراکنشی با این شناسه پیدا نشد."
                : "بازیابی تراکنش از درگاه ناموفق بود."}
            </p>
            {!missing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void lookup.refetch()}
                disabled={lookup.isFetching}
              >
                <RotateCw className="size-4" aria-hidden /> تلاش دوباره
              </Button>
            ) : null}
          </div>
        ) : null}

        {lookup.data ? (
          <article className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={lookup.data.status} />
                <span className="text-xs text-muted-foreground">
                  {PAYMENT_FA[lookup.data.payment_method]}
                </span>
              </div>
              <p
                className="mt-2 break-all font-mono text-sm font-semibold"
                dir="ltr"
              >
                {lookup.data.transaction_id}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatPaymentAmount(lookup.data.amount, lookup.data.currency)}{" "}
                · {faDateTime(lookup.data.created_at)}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/payments/${lookup.data.id}`}>
                مشاهدهٔ جزئیات <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </Button>
          </article>
        ) : null}
      </div>
    </section>
  );
}
