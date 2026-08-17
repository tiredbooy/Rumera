"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  RotateCw,
} from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_FA } from "@/features/orders/labels";
import { useAdminPayments } from "@/features/payments/hooks";
import { formatPaymentAmount } from "@/features/payments/presentation";
import type { AdminPaymentTransaction } from "@/features/payments/types";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { adminCustomerHref } from "../customer-href";
import { PaymentStatusBadge } from "./payment-status-badge";

type PaymentsQuery = ReturnType<typeof useAdminPayments>;

function PaymentUserLink({ userId }: { userId?: string }) {
  const href = adminCustomerHref(userId);
  if (!href || !userId) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Link
      href={href}
      className="block truncate rounded-md font-mono text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      dir="ltr"
      title={userId}
    >
      {userId}
    </Link>
  );
}

function PaymentLoading() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری تراکنش‌های پرداخت"
      className="space-y-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="border-hairline flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]"
        >
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="ms-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function PaymentMobileCard({ payment }: { payment: AdminPaymentTransaction }) {
  return (
    <article className="border-hairline min-w-0 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.04]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/payments/${payment.id}`}
            className="rounded-md font-mono text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            dir="ltr"
          >
            #{payment.id}
          </Link>
          <p
            className="mt-1 break-all font-mono text-xs text-muted-foreground"
            dir="ltr"
          >
            {payment.transaction_id}
          </p>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">مبلغ</dt>
          <dd className="mt-1 font-medium">
            {formatPaymentAmount(payment.amount, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">روش</dt>
          <dd className="mt-1">{PAYMENT_FA[payment.payment_method]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">سفارش</dt>
          <dd className="mt-1">
            {payment.order_id ? (
              <Link
                href={`/admin/orders/${payment.order_id}`}
                className="rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                #{faNum(payment.order_id)}
              </Link>
            ) : (
              "بدون سفارش"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">کاربر</dt>
          <dd className="mt-1">
            <PaymentUserLink userId={payment.user_id} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">ثبت</dt>
          <dd className="mt-1" dir="ltr">
            {faDateTime(payment.created_at)}
          </dd>
        </div>
      </dl>
      <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
        <Link href={`/admin/payments/${payment.id}`}>
          جزئیات تراکنش <ArrowLeft className="size-4" aria-hidden />
        </Link>
      </Button>
    </article>
  );
}

export function PaymentListResults({
  payments,
  page,
  hasFilters,
  outOfRangePage,
  onPage,
}: {
  payments: PaymentsQuery;
  page: number;
  hasFilters: boolean;
  outOfRangePage: boolean;
  onPage: (page?: number) => void;
}) {
  if (payments.isLoading) return <PaymentLoading />;

  if (payments.isError && !payments.data) {
    return (
      <div
        role="alert"
        className="border-hairline flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-card px-5 text-center ring-1 ring-foreground/[0.04]"
      >
        <p className="font-medium">بارگذاری تراکنش‌های پرداخت ناموفق بود.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={payments.isFetching}
          onClick={() => void payments.refetch()}
        >
          {payments.isFetching ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RotateCw className="size-4" aria-hidden />
          )}
          {payments.isFetching ? "در حال تلاش…" : "تلاش دوباره"}
        </Button>
      </div>
    );
  }

  if (!payments.data) return null;

  return (
    <>
      {payments.isError ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p>
            به‌روزرسانی ناموفق بود؛ دادهٔ نمایش‌داده‌شده ممکن است قدیمی باشد.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void payments.refetch()}
          >
            <RotateCw className="size-4" aria-hidden /> تلاش دوباره
          </Button>
        </div>
      ) : null}

      {payments.data.results.length === 0 ? (
        <div className="border-hairline flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl bg-card px-5 text-center ring-1 ring-foreground/[0.04]">
          <CreditCard className="size-9 text-muted-foreground" aria-hidden />
          <p className="font-serif text-lg">
            {outOfRangePage
              ? "در حال بازگشت به آخرین صفحه…"
              : hasFilters
                ? "تراکنشی با این فیلترها پیدا نشد."
                : "هنوز تراکنش پرداختی ثبت نشده است."}
          </p>
        </div>
      ) : (
        <div aria-busy={payments.isFetching || undefined}>
          <div className="grid gap-3 lg:hidden">
            {payments.data.results.map((payment) => (
              <PaymentMobileCard key={payment.id} payment={payment} />
            ))}
          </div>
          <div className="border-hairline hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04] lg:block">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[20%] text-start">تراکنش</TableHead>
                  <TableHead className="w-[10%] text-start">سفارش</TableHead>
                  <TableHead className="w-[18%] text-start">کاربر</TableHead>
                  <TableHead className="w-[16%] text-start">مبلغ</TableHead>
                  <TableHead className="w-[12%] text-start">روش</TableHead>
                  <TableHead className="w-[12%] text-start">وضعیت</TableHead>
                  <TableHead className="w-[12%] text-start">زمان ثبت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data.results.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="max-w-56">
                      <Link
                        href={`/admin/payments/${payment.id}`}
                        className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className="font-mono text-xs font-semibold"
                          dir="ltr"
                        >
                          #{payment.id}
                        </span>
                        <span
                          className="mt-1 block truncate font-mono text-xs text-muted-foreground"
                          dir="ltr"
                          title={payment.transaction_id}
                        >
                          {payment.transaction_id}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {payment.order_id ? (
                        <Link
                          href={`/admin/orders/${payment.order_id}`}
                          className="rounded-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          #{faNum(payment.order_id)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40">
                      <PaymentUserLink userId={payment.user_id} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPaymentAmount(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {PAYMENT_FA[payment.payment_method]}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">
                      {faDateTime(payment.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {payments.data.pagination.total_items > 0 ? (
        <ListPagination
          page={payments.data.pagination.page}
          totalPages={payments.data.pagination.total_pages}
          hasPrev={payments.data.pagination.has_prev}
          hasNext={payments.data.pagination.has_next}
          onPrev={() => onPage(page > 2 ? page - 1 : undefined)}
          onNext={() => onPage(page + 1)}
          disabled={payments.isFetching}
          ariaLabel="صفحه‌بندی تراکنش‌های پرداخت"
          className="mt-6"
          label={
            <>
              {faNum(payments.data.pagination.total_items)} تراکنش · صفحهٔ{" "}
              {faNum(payments.data.pagination.page)} از{" "}
              {faNum(payments.data.pagination.total_pages)}
            </>
          }
        />
      ) : null}
    </>
  );
}
