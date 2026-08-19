"use client";

import * as React from "react";
import {
  Banknote,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";
import { faNum, formatPrice } from "@/lib/products";
import { apiErrorToast } from "@/lib/api/user-facing-error";

import { newWalletIdempotencyKey } from "./api";
import { useWalletTopUp } from "./hooks";
import type { WalletTopUpIntent } from "./types";
import {
  isValidTopUpAmount,
  usablePaymentUrl,
  WALLET_TOPUP_MAX,
  WALLET_TOPUP_MIN,
  WALLET_TOPUP_PRESETS,
} from "./types";

type Phase = "form" | "pending";

/**
 * Gateway wallet top-up (PH-041b). Creates a pending payment only —
 * balance increases after webhook success, not free deposit.
 */
export function WalletTopUp({
  onSettledRefresh,
}: {
  /** Called after intent created or user requests refresh (poll balance/ledger). */
  onSettledRefresh?: () => void;
}) {
  const topUp = useWalletTopUp();
  const [amount, setAmount] = React.useState<number | null>(
    WALLET_TOPUP_PRESETS[1],
  );
  const [custom, setCustom] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("form");
  const [intent, setIntent] = React.useState<WalletTopUpIntent | null>(null);
  const idemRef = React.useRef(newWalletIdempotencyKey());

  const selected =
    custom.trim() !== ""
      ? parseAsciiNumber(toAsciiDigits(custom).replace(/,/g, ""))
      : (amount ?? 0);

  function pickPreset(value: number) {
    setAmount(value);
    setCustom("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidTopUpAmount(selected)) {
      toast.error("مبلغ نامعتبر است", {
        description: `حداقل ${formatPrice(WALLET_TOPUP_MIN)} و حداکثر ${formatPrice(WALLET_TOPUP_MAX)}`,
      });
      return;
    }
    topUp.mutate(
      { amount: selected, idempotencyKey: idemRef.current },
      {
        onSuccess: (data) => {
          setIntent(data);
          setPhase("pending");
          idemRef.current = newWalletIdempotencyKey();
          toast.success("درخواست شارژ ثبت شد", {
            description:
              "پس از پرداخت موفق در درگاه، موجودی به‌روزرسانی می‌شود.",
          });
          onSettledRefresh?.();
        },
        onError: (err) => {
          const t = apiErrorToast(err, "ثبت درخواست شارژ ناموفق بود");
          toast.error(t.title, { description: t.description });
        },
      },
    );
  }

  function copyTxId() {
    if (!intent?.transaction_id) return;
    void navigator.clipboard?.writeText(intent.transaction_id).then(
      () => toast.success("شناسهٔ پرداخت کپی شد"),
      () => toast.error("کپی ناموفق بود"),
    );
  }

  function startAnother() {
    setPhase("form");
    setIntent(null);
    setAmount(WALLET_TOPUP_PRESETS[1]);
    setCustom("");
    idemRef.current = newWalletIdempotencyKey();
  }

  if (phase === "pending" && intent) {
    const payHref = usablePaymentUrl(intent.payment_url);
    return (
      <div
        className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
        data-testid="wallet-topup-pending"
      >
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <CheckCircle2 className="size-5 text-primary" />
          در انتظار پرداخت
        </h2>
        <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
          مبلغ{" "}
          <strong className="font-medium text-foreground">
            {formatPrice(intent.amount)}
          </strong>{" "}
          ثبت شد. موجودی{" "}
          <strong className="font-medium text-foreground">فقط پس از</strong>{" "}
          تأیید پرداخت درگاه افزایش می‌یابد — شارژ رایگان نیست.
        </p>
        <div className="mt-4 space-y-2 rounded-2xl bg-muted/40 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">شناسهٔ پرداخت درگاه</span>
            <button
              type="button"
              onClick={copyTxId}
              className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
              dir="ltr"
            >
              {intent.transaction_id}
              <Copy className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">وضعیت</span>
            <span className="font-medium">{intent.status}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">ارز</span>
            <span dir="ltr">{intent.currency}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {payHref
            ? "برای تکمیل پرداخت، «پرداخت در درگاه» را بزنید. سپس «بروزرسانی موجودی» را بزنید."
            : "پرداخت را در درگاه با همین شناسه تکمیل کنید. سپس «بروزرسانی موجودی» را بزنید."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {payHref ? (
            <Button asChild variant="default" className="h-11 cursor-pointer">
              <a href={payHref} data-testid="wallet-topup-pay">
                <ExternalLink className="size-4" />
                پرداخت در درگاه
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant={payHref ? "outline" : "default"}
            className="h-11 cursor-pointer"
            onClick={() => onSettledRefresh?.()}
          >
            <RefreshCw className="size-4" />
            بروزرسانی موجودی
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer"
            onClick={startAnother}
          >
            شارژ جدید
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
      data-testid="wallet-topup-form"
    >
      <h2 className="flex items-center gap-2 font-serif text-2xl">
        <Banknote className="size-5 text-primary" /> شارژ از درگاه
      </h2>
      <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
        مبلغ را انتخاب کنید. پس از ثبت، پرداخت را در درگاه انجام دهید — تا قبل از
        تأیید درگاه، موجودی تغییر نمی‌کند.
      </p>

      <div className="mt-4">
        <Label className="mb-2 block">مبالغ پیشنهادی</Label>
        <div className="flex flex-wrap gap-2">
          {WALLET_TOPUP_PRESETS.map((preset) => {
            const active = custom === "" && amount === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => pickPreset(preset)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-sm tabular-nums ring-1 transition-colors",
                  active
                    ? "bg-primary/15 font-medium text-primary ring-primary/30"
                    : "bg-muted/40 text-muted-foreground ring-foreground/10 hover:text-foreground",
                )}
                dir="ltr"
              >
                {formatPrice(preset)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor="wallet-topup-custom">مبلغ دلخواه (تومان)</Label>
        <Input
          id="wallet-topup-custom"
          type="number"
          inputMode="numeric"
          min={WALLET_TOPUP_MIN}
          max={WALLET_TOPUP_MAX}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setAmount(null);
          }}
          placeholder={`${faNum(WALLET_TOPUP_MIN)} – ${faNum(WALLET_TOPUP_MAX)}`}
          dir="ltr"
          className="h-11 max-w-xs text-start"
        />
        <p className="text-xs text-muted-foreground">
          حداقل {formatPrice(WALLET_TOPUP_MIN)} · حداکثر{" "}
          {formatPrice(WALLET_TOPUP_MAX)}
        </p>
      </div>

      {selected > 0 ? (
        <p className="mt-3 text-sm font-medium text-foreground">
          مبلغ انتخاب‌شده:{" "}
          <span dir="ltr">{formatPrice(selected)}</span>
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={topUp.isPending || !isValidTopUpAmount(selected)}
        className="mt-5 h-11 cursor-pointer"
      >
        {topUp.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Banknote className="size-4" />
        )}
        ثبت درخواست شارژ
      </Button>
    </form>
  );
}
