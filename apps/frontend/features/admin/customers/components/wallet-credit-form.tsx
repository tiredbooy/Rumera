"use client";

import * as React from "react";
import { Loader2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/store-client";
import { apiErrorToast } from "@/lib/api/user-facing-error";
import { parseAsciiNumber } from "@/lib/normalize-digits";
import { faNum, formatPrice } from "@/lib/products";

type CreditResponse = {
  transaction?: { id?: number; amount?: string; balance_after?: string };
  actor_user_id?: string;
  idempotency_key?: string;
  replayed?: boolean;
  // legacy shape tolerance
  id?: number;
};

/**
 * Admin wallet top-up for a customer (Task 083a).
 *
 * - Capability gate: only rendered when the operator has wallet:credit
 *   (not customers:write; not roles:manage — PR-040c)
 * - Confirmation dialog before POST
 * - Client-generated idempotency key (stable per pending credit)
 * - Backend records actor + key; replays return 200 with replayed=true
 *
 * CF-3: the balance the credit lands on is shown on the form and repeated in the
 * confirmation, because this screen used to mint money with no balance in view —
 * the operator granting credit could not see what the customer already had. The
 * new balance is read back from the ledger row the server returns, never from
 * client arithmetic on money.
 */
export function WalletCreditForm({
  userId,
  userLabel,
  balance,
  canCredit = true,
}: {
  userId: string;
  userLabel: string;
  /**
   * `wallet_balance` from the admin customer read, as an exact decimal string.
   * `undefined` means it was not read — shown as unknown, never as zero.
   */
  balance?: string;
  /** When false the form is not rendered (server capability gate). */
  canCredit?: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Stable key for the current pending credit attempt; regenerated after success.
  const [idempotencyKey, setIdempotencyKey] = React.useState(() =>
    newIdempotencyKey(),
  );

  if (!canCredit) {
    return null;
  }

  function openConfirm(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAsciiNumber(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("مبلغ باید عددی بزرگ‌تر از صفر باشد");
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmCredit() {
    const value = parseAsciiNumber(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setConfirmOpen(false);
      return;
    }
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/admin/users/${encodeURIComponent(userId)}/wallet/credit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            amount: value,
            description: description.trim() || undefined,
            idempotency_key: idempotencyKey,
          }),
        },
      );
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (body as { error?: { message?: string } } | null)?.error?.message ??
          res.statusText;
        throw new ApiClientError(
          res.status,
          (body as { error?: { code?: string } } | null)?.error?.code ??
            "UNKNOWN",
          message,
        );
      }
      const data = unwrapData<CreditResponse>(body);
      const replayed = Boolean(data?.replayed);
      // The ledger row carries the balance the server actually landed on. Adding
      // the amount to the displayed balance here would be float money math.
      // Only on a fresh credit: a replay returns the original ledger row, whose
      // balance_after is the balance as of that first credit, not the current one.
      const after = replayed ? undefined : data?.transaction?.balance_after;
      toast.success(
        replayed
          ? "این واریز قبلاً ثبت شده بود"
          : "موجودی کیف پول افزایش یافت",
        {
          description: after
            ? `${formatPrice(value)} برای ${userLabel} — موجودی جدید ${formatPrice(after)}`
            : `${formatPrice(value)} برای ${userLabel}`,
        },
      );
      setAmount("");
      setDescription("");
      setIdempotencyKey(newIdempotencyKey());
      setConfirmOpen(false);
      // Re-read the server projection so the balance above the form and the
      // ledger trail beside it stop showing the pre-credit figure.
      router.refresh();
    } catch (error) {
      const t = apiErrorToast(error, "افزایش موجودی ناموفق بود");
      toast.error(t.title, { description: t.description });
    } finally {
      setPending(false);
    }
  }

  const amountValue = parseAsciiNumber(amount);
  const amountValid = Number.isFinite(amountValue) && amountValue > 0;

  return (
    <>
      <form
        onSubmit={openConfirm}
        className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        data-testid="wallet-credit-form"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Wallet className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-lg">افزایش موجودی کیف پول</h2>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="text-muted-foreground">موجودی فعلی</span>
              <strong
                className="tabular-nums text-foil"
                data-testid="wallet-credit-balance"
              >
                {balance === undefined ? "نامشخص" : formatPrice(balance)}
              </strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              مبلغ پس از تأیید شما به کیف پول {userLabel} واریز می‌شود. از کلید
              یکتای درخواست برای جلوگیری از واریز تکراری استفاده می‌شود.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wallet-credit-amount">مبلغ (تومان)</Label>
            <Input
              id="wallet-credit-amount"
              type="number"
              min={1}
              step={1}
              dir="ltr"
              inputMode="numeric"
              placeholder="۵۰۰۰۰۰"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending}
              required
              data-testid="wallet-credit-amount"
            />
            {amountValid ? (
              <p className="text-xs text-muted-foreground">
                معادل {faNum(amountValue)} تومان
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="wallet-credit-desc">توضیح (اختیاری)</Label>
            <Textarea
              id="wallet-credit-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending}
              placeholder="مثلاً جبران خطا یا هدیه"
              maxLength={500}
              data-testid="wallet-credit-desc"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            disabled={pending || !amountValid}
            className="h-11"
            data-testid="wallet-credit-submit"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            ادامه و تأیید
          </Button>
        </div>
      </form>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent data-testid="wallet-credit-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>تأیید افزایش موجودی</AlertDialogTitle>
            <AlertDialogDescription>
              {amountValid
                ? `موجودی فعلی «${userLabel}» ${
                    balance === undefined ? "نامشخص" : formatPrice(balance)
                  } است و مبلغ ${formatPrice(amountValue)} به آن افزوده می‌شود. این عملیات پس از تأیید قابل برگشت خودکار نیست.`
                : "مبلغ نامعتبر است."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              disabled={pending}
              data-testid="wallet-credit-cancel"
            >
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={pending || !amountValid}
              data-testid="wallet-credit-confirm-action"
              onClick={(event) => {
                event.preventDefault();
                void confirmCredit();
              }}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "بله، واریز شود"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `wc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function unwrapData<T>(body: unknown): T {
  if (
    body &&
    typeof body === "object" &&
    "data" in body &&
    (body as { data: unknown }).data !== undefined
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}
