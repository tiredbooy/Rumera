"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Loader2,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { PAYMENT_FA } from "@/features/orders/labels";
import { PaymentApiError } from "@/features/payments/api/admin-client";
import { useAdminPayment } from "@/features/payments/hooks";
import {
  decodePaymentRawResponse,
  formatPaymentAmount,
} from "@/features/payments/presentation";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { adminCustomerHref } from "../customer-href";
import { PaymentStatusBadge } from "./payment-status-badge";

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-border/50 py-3 last:border-0 sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm sm:mt-0">{children}</dd>
    </div>
  );
}

export function PaymentDetailView({ paymentID }: { paymentID: number }) {
  const payment = useAdminPayment(paymentID);
  const [copied, setCopied] = React.useState(false);

  async function copyTransactionID() {
    if (!payment.data) return;
    try {
      await navigator.clipboard.writeText(payment.data.transaction_id);
      setCopied(true);
      toast.success("شناسهٔ تراکنش کپی شد");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("کپی شناسه ناموفق بود");
    }
  }

  if (payment.isLoading) {
    return (
      <div role="status" aria-label="در حال بارگذاری جزئیات پرداخت">
        <Skeleton className="mb-6 h-16 w-full max-w-xl" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (payment.isError || !payment.data) {
    const missing =
      payment.error instanceof PaymentApiError && payment.error.status === 404;
    return (
      <>
        <PageHeader title={`تراکنش #${faNum(paymentID)}`} />
        <div
          role="alert"
          className="border-hairline flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl bg-card px-6 text-center ring-1 ring-foreground/[0.04]"
        >
          <CreditCard className="size-9 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-serif text-lg">
              {missing
                ? "این تراکنش پیدا نشد"
                : "دریافت جزئیات پرداخت ناموفق بود"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {missing
                ? "ممکن است شناسه حذف شده یا نشانی واردشده نادرست باشد."
                : "اتصال را بررسی کنید و دوباره تلاش کنید."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {!missing ? (
              <Button
                type="button"
                variant="outline"
                disabled={payment.isFetching}
                onClick={() => void payment.refetch()}
              >
                {payment.isFetching ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RotateCw className="size-4" aria-hidden />
                )}
                تلاش دوباره
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/admin/payments">
                <ArrowRight className="size-4" aria-hidden /> بازگشت به
                پرداخت‌ها
              </Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const data = payment.data;
  const decodedRawResponse = decodePaymentRawResponse(data.raw_response);
  const customerHref = adminCustomerHref(data.user_id);

  return (
    <>
      <PageHeader
        eyebrow={
          <nav
            aria-label="مسیر"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Link href="/admin/payments" className="hover:text-foreground">
              پرداخت‌ها
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground" dir="ltr">
              #{data.id}
            </span>
          </nav>
        }
        title={`تراکنش #${faNum(data.id)}`}
        description={`ثبت‌شده در ${faDateTime(data.created_at)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/payments">
              <ArrowRight className="size-4" aria-hidden /> بازگشت
            </Link>
          </Button>
        }
      />

      {data.error_message ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span className="font-medium">پیام خطای درگاه: </span>
          <span dir="auto">{data.error_message}</span>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          aria-labelledby="payment-detail-title"
          className="border-hairline min-w-0 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 id="payment-detail-title" className="font-serif text-lg">
              مشخصات تراکنش
            </h2>
            <PaymentStatusBadge status={data.status} />
          </div>
          <dl>
            <DetailItem label="شناسهٔ درگاه">
              <div className="flex min-w-0 items-center gap-2">
                <code className="min-w-0 break-all font-mono text-xs" dir="ltr">
                  {data.transaction_id}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="کپی شناسهٔ تراکنش"
                  onClick={() => void copyTransactionID()}
                >
                  {copied ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </DetailItem>
            <DetailItem label="مبلغ">
              <span className="font-medium">
                {formatPaymentAmount(data.amount, data.currency)}
              </span>
            </DetailItem>
            <DetailItem label="روش پرداخت">
              {PAYMENT_FA[data.payment_method]}
            </DetailItem>
            <DetailItem label="سفارش">
              {data.order_id ? (
                <Link
                  href={`/admin/orders/${data.order_id}`}
                  className="rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  سفارش #{faNum(data.order_id)}
                </Link>
              ) : (
                <span className="text-muted-foreground">
                  به سفارشی متصل نیست
                </span>
              )}
            </DetailItem>
            <DetailItem label="کاربر">
              {customerHref ? (
                <Link
                  href={customerHref}
                  className="break-all rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  dir="ltr"
                >
                  {data.user_id}
                </Link>
              ) : (
                <span className="text-muted-foreground">ثبت نشده</span>
              )}
            </DetailItem>
            <DetailItem label="زمان ثبت">
              <span dir="ltr">{faDateTime(data.created_at)}</span>
            </DetailItem>
            <DetailItem label="زمان پرداخت">
              {data.paid_at ? (
                <span dir="ltr">{faDateTime(data.paid_at)}</span>
              ) : (
                <span className="text-muted-foreground">پرداخت نشده</span>
              )}
            </DetailItem>
          </dl>
        </section>

        <aside className="min-w-0 space-y-5">
          <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
            <h2 className="font-serif text-base">کاربرد عملیاتی</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              وضعیت این رکورد توسط جریان سفارش و پاسخ درگاه تعیین می‌شود. هیچ
              تغییر دستی برای پرداخت پشتیبانی نمی‌شود.
            </p>
          </div>
        </aside>
      </div>

      <section className="border-hairline mt-5 min-w-0 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
        <details>
          <summary className="cursor-pointer rounded-md font-serif text-base outline-none focus-visible:ring-2 focus-visible:ring-ring">
            پاسخ خام درگاه
          </summary>
          {decodedRawResponse ? (
            <pre
              className="mt-4 max-h-96 overflow-auto rounded-xl bg-muted/60 p-4 text-xs leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]"
              dir="ltr"
            >
              {decodedRawResponse}
            </pre>
          ) : data.raw_response ? (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                پاسخ قابل رمزگشایی نبود؛ مقدار پایهٔ ۶۴ نمایش داده می‌شود.
              </p>
              <pre
                className="mt-2 overflow-auto rounded-xl bg-muted/60 p-4 text-xs [overflow-wrap:anywhere]"
                dir="ltr"
              >
                {data.raw_response}
              </pre>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              پاسخی از درگاه برای این تراکنش ذخیره نشده است.
            </p>
          )}
        </details>
      </section>
    </>
  );
}
