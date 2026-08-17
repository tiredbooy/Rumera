import "server-only";

import { redirect } from "next/navigation";
import { History } from "lucide-react";

import { ListPagination } from "@/components/list-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { loyaltyReasonLabel } from "@/features/loyalty/reasons";
import { ApiError } from "@/lib/api/errors";
import type { Pagination } from "@/lib/api/types";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { listLoyaltyMemberTransactions } from "../api/server";
import { signedPoints } from "../labels";
import type { LoyaltyMemberTransaction } from "../types";
import { LoyaltyLedgerFilterBar } from "./loyalty-ledger-filters";

const PAGE_SIZE = 20;

export function LoyaltyLedgerSkeleton() {
  return (
    <div
      className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/40 px-4 py-4 last:border-0"
        >
          <div className="h-3.5 w-10 animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function memberLedgerHref(
  userID: string,
  page: number,
  reason?: string,
): string {
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/loyalty/${userID}?${qs}` : `/admin/loyalty/${userID}`;
}

export async function LoyaltyMemberLedger({
  userID,
  page,
  reason,
}: {
  userID: string;
  page: number;
  reason?: string;
}) {
  let data;
  try {
    data = await listLoyaltyMemberTransactions(userID, {
      page,
      limit: PAGE_SIZE,
      reason,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 404 || error.status === 422)
    ) {
      throw error;
    }
    return (
      <section className="mt-6" aria-labelledby="loyalty-ledger-title">
        <LedgerHeading totalItems={null} />
        <AdminDataErrorState
          title="دریافت دفتر کل ناموفق بود"
          description="هیچ ردیف جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
        />
      </section>
    );
  }

  if (data.pagination.total_pages > 0 && page > data.pagination.total_pages) {
    redirect(memberLedgerHref(userID, data.pagination.total_pages, reason));
  }

  return (
    <LoyaltyMemberLedgerView
      userID={userID}
      reason={reason}
      transactions={data.results}
      pagination={data.pagination}
    />
  );
}

export function LoyaltyMemberLedgerView({
  userID,
  reason,
  transactions,
  pagination,
}: {
  userID: string;
  reason?: string;
  transactions: LoyaltyMemberTransaction[];
  pagination: Pagination;
}) {
  return (
    <section className="mt-6" aria-labelledby="loyalty-ledger-title">
      <LedgerHeading totalItems={pagination.total_items} />
      <LoyaltyLedgerFilterBar userID={userID} reason={reason} />

      {transactions.length === 0 ? (
        <div className="border-hairline flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-10 text-center ring-1 ring-foreground/[0.04]">
          <History className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            {reason ? "ردیفی با این علت نیست" : "هنوز ردیفی در دفتر کل نیست"}
          </p>
          <p className="text-xs text-muted-foreground">
            {reason
              ? "علت دیگری را انتخاب کنید یا فیلتر را پاک کنید."
              : "اهدا، برگشت، خرید پرداخت‌شده و بازخرید در اینجا ثبت می‌شوند."}
          </p>
        </div>
      ) : (
        <div className="border-hairline overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                  شناسه
                </TableHead>
                <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                  دلتا
                </TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                  علت
                </TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                  مرجع
                </TableHead>
                <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                  زمان
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="border-border/40">
                  <TableCell className="font-mono text-xs tabular-nums" dir="ltr">
                    {faNum(tx.id)}
                  </TableCell>
                  <TableCell
                    className={
                      tx.delta < 0
                        ? "text-end font-medium tabular-nums text-destructive"
                        : "text-end font-medium tabular-nums"
                    }
                    dir="ltr"
                  >
                    {signedPoints(tx.delta)}
                  </TableCell>
                  <TableCell>
                    <span className="block">{loyaltyReasonLabel(tx.reason)}</span>
                    <span className="font-mono text-[0.7rem] text-muted-foreground">
                      {tx.reason}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    <span className="block text-xs">{tx.ref_type || "—"}</span>
                    <span
                      className="block truncate font-mono text-[0.7rem] text-muted-foreground"
                      dir="ltr"
                      title={tx.ref_id}
                    >
                      {tx.ref_id || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-end text-xs text-muted-foreground tabular-nums">
                    {faDateTime(tx.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ListPagination
        page={pagination.page}
        totalPages={pagination.total_pages}
        hasPrev={pagination.has_prev}
        hasNext={pagination.has_next}
        prevHref={memberLedgerHref(userID, pagination.page - 1, reason)}
        nextHref={memberLedgerHref(userID, pagination.page + 1, reason)}
        ariaLabel="صفحه‌بندی دفتر کل"
        className="mt-4"
      />
    </section>
  );
}

function LedgerHeading({ totalItems }: { totalItems: number | null }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2
          id="loyalty-ledger-title"
          className="flex items-center gap-2 font-serif text-lg"
        >
          <History className="size-4.5 text-primary" aria-hidden />
          دفتر کل امتیاز
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          شامل شناسه، دلتا، علت و مراجع (`ref_type` / `ref_id`).
        </p>
      </div>
      {totalItems !== null ? (
        <p className="text-xs text-muted-foreground">
          {faNum(totalItems)} ردیف
        </p>
      ) : null}
    </div>
  );
}