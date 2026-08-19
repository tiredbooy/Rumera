import "server-only";

import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  ShoppingBag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge, type BadgeSemantic } from "@/components/ui/badge";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import type {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from "@/features/wallet/types";
import { isCreditTransaction } from "@/features/wallet/types";
import { ApiError } from "@/lib/api/errors";
import { faNum, formatPrice } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import { listCustomerWalletTransactions } from "../api";

/** Ledger rows shown inline; the panel is a trail, not a paginated ledger. */
const LEDGER_ROWS = 6;

// Same four kinds the account wallet names, with the icon carried alongside so
// direction is never signalled by colour alone.
const TYPE_META: Record<
  WalletTransactionType,
  { label: string; icon: LucideIcon }
> = {
  deposit: { label: "افزایش موجودی", icon: ArrowDownLeft },
  refund: { label: "بازگشت وجه", icon: RotateCcw },
  withdraw: { label: "برداشت", icon: ArrowUpRight },
  purchase: { label: "خرید", icon: ShoppingBag },
};

const STATUS_META: Record<
  WalletTransactionStatus,
  { label: string; semantic: BadgeSemantic } | null
> = {
  // A completed row is the norm — badging every one of them is noise.
  completed: null,
  pending: { label: "در انتظار", semantic: { tone: "warning" } },
  failed: { label: "ناموفق", semantic: { variant: "destructive" } },
  cancelled: { label: "لغوشده", semantic: { tone: "neutral" } },
};

/** `ledger: null` is a failed read — an empty array is a customer who never transacted. */
export type CustomerLedger = {
  ledger: WalletTransaction[] | null;
  ledgerTotal: number;
};

export async function loadCustomerLedger(
  userID: string,
): Promise<CustomerLedger> {
  try {
    const page = await listCustomerWalletTransactions(userID, {
      page: 1,
      limit: LEDGER_ROWS,
    });
    return { ledger: page.results, ledgerTotal: page.pagination.total_items };
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    // Balance still renders; only the trail is missing.
    return { ledger: null, ledgerTotal: 0 };
  }
}

/**
 * Wallet balance and ledger trail on the customer file (CF-3).
 *
 * The balance is the first thing on the panel because the credit form that sits
 * under it mints ledger money: an operator granting credit used to have no way
 * to see what the customer already had without leaving the screen.
 *
 * The trail matters on its own — a wallet-paid order settles inside the order
 * transaction and writes no payment row, so for those purchases this is the only
 * admin record of the debit.
 */
export function CustomerWalletPanel({
  balance,
  ledger,
  ledgerTotal,
}: {
  /** `wallet_balance` from the admin detail read; absent means "not read". */
  balance?: string;
} & CustomerLedger) {
  return (
    <section className="mt-6" aria-labelledby="customer-wallet-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2
          id="customer-wallet-title"
          className="flex items-center gap-2 font-serif text-lg"
        >
          <Wallet className="size-4.5 text-primary" aria-hidden />
          کیف پول
        </h2>
        {ledger ? (
          <p className="text-xs text-muted-foreground">
            {faNum(ledgerTotal)} تراکنش
          </p>
        ) : null}
      </div>

      <div
        className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        data-testid="customer-wallet-panel"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">موجودی فعلی</span>
          <strong
            className="font-serif text-2xl tabular-nums text-foil"
            data-testid="customer-wallet-balance"
          >
            {balance === undefined ? "نامشخص" : formatPrice(balance)}
          </strong>
        </div>
        {balance === undefined ? (
          <p className="mt-1 text-xs text-muted-foreground">
            موجودی خوانده نشد. پیش از هر واریز، صفحه را تازه کنید.
          </p>
        ) : null}

        <div className="mt-4 border-t border-border/50 pt-4">
          {ledger === null ? (
            <AdminDataErrorState
              title="دریافت تراکنش‌های کیف پول ناموفق بود"
              description="موجودی بالا از پروندهٔ کاربر خوانده شده است، اما فهرست تراکنش‌ها نمایش داده نشد."
              className="px-4 py-8"
            />
          ) : ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              هنوز تراکنشی در کیف پول این کاربر ثبت نشده است.
            </p>
          ) : (
            <ol className="grid gap-2">
              {ledger.map((row) => (
                <li key={row.id}>
                  <LedgerRow row={row} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function LedgerRow({ row }: { row: WalletTransaction }) {
  const meta = TYPE_META[row.type];
  const Icon = meta?.icon ?? Wallet;
  const credit = isCreditTransaction(row);
  const status = STATUS_META[row.status];

  return (
    <article className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/30 px-3 py-2 text-sm">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-foreground/[0.06]"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {meta?.label ?? row.type}
          {status ? (
            <Badge {...status.semantic} className="rounded-full">
              {status.label}
            </Badge>
          ) : null}
        </p>
        {row.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <bdi dir="auto">{row.description}</bdi>
          </p>
        ) : null}
        {row.reference_order_id ? (
          <Link
            href={`/admin/orders/${row.reference_order_id}`}
            className="mt-0.5 inline-flex text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            سفارش #{faNum(row.reference_order_id)}
          </Link>
        ) : null}
      </div>
      <div className="shrink-0 text-end">
        <p className="font-medium tabular-nums" dir="ltr">
          {/* Sign, not colour: «+» / «−» reads the same in a screen reader. */}
          {credit ? "+" : "−"}
          {formatPrice(row.amount)}
        </p>
        <time
          dateTime={row.created_at}
          className="text-xs text-muted-foreground tabular-nums"
        >
          {faDateTime(row.created_at)}
        </time>
      </div>
    </article>
  );
}
