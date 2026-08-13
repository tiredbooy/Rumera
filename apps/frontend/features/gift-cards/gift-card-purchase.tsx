"use client";

import * as React from "react";
import {
  CheckCircle2,
  Copy,
  Gift,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { faNum, formatPrice } from "@/lib/products";
import { apiErrorToast } from "@/lib/api/user-facing-error";

import { newGiftCardIdempotencyKey } from "./api/account";
import { usePurchaseGiftCard } from "./hooks";
import type { GiftCardPurchaseIntent } from "./types";
import {
  GIFT_CARD_PURCHASE_MAX,
  GIFT_CARD_PURCHASE_MIN,
  GIFT_CARD_PURCHASE_PRESETS,
  isValidGiftCardPurchaseAmount,
} from "./types";

type Phase = "form" | "pending";

/**
 * Gateway gift-card purchase (PH-042b). Creates a pending payment only —
 * code appears under «کارت‌های خریداری‌شده» after webhook success.
 */
export function GiftCardPurchase({
  onSettledRefresh,
}: {
  /** After intent created or user refreshes (poll mine list). */
  onSettledRefresh?: () => void;
}) {
  const purchase = usePurchaseGiftCard();
  const [amount, setAmount] = React.useState<number | null>(
    GIFT_CARD_PURCHASE_PRESETS[1],
  );
  const [custom, setCustom] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("form");
  const [intent, setIntent] = React.useState<GiftCardPurchaseIntent | null>(
    null,
  );
  const idemRef = React.useRef(newGiftCardIdempotencyKey("gbuy"));

  const selected =
    custom.trim() !== ""
      ? Number(custom.replace(/,/g, ""))
      : (amount ?? 0);

  function pickPreset(value: number) {
    setAmount(value);
    setCustom("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidGiftCardPurchaseAmount(selected)) {
      toast.error("مبلغ نامعتبر است", {
        description: `حداقل ${formatPrice(GIFT_CARD_PURCHASE_MIN)} و حداکثر ${formatPrice(GIFT_CARD_PURCHASE_MAX)}`,
      });
      return;
    }
    purchase.mutate(
      { amount: selected, idempotencyKey: idemRef.current },
      {
        onSuccess: (data) => {
          setIntent(data);
          setPhase("pending");
          idemRef.current = newGiftCardIdempotencyKey("gbuy");
          toast.success("درخواست خرید کارت هدیه ثبت شد", {
            description:
              "پس از پرداخت موفق در درگاه، کد کارت در بخش «کارت‌های من» ظاهر می‌شود.",
          });
          onSettledRefresh?.();
        },
        onError: (err) => {
          const t = apiErrorToast(err, "ثبت خرید کارت هدیه ناموفق بود");
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
    setAmount(GIFT_CARD_PURCHASE_PRESETS[1]);
    setCustom("");
    idemRef.current = newGiftCardIdempotencyKey("gbuy");
  }

  if (phase === "pending" && intent) {
    return (
      <div
        className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
        data-testid="gift-card-purchase-pending"
      >
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <CheckCircle2 className="size-5 text-primary" />
          در انتظار پرداخت
        </h2>
        <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
          مبلغ{" "}
          <strong className="font-medium text-foreground">
            {formatPrice(Number(intent.amount))}
          </strong>{" "}
          ثبت شد. کد کارت هدیه{" "}
          <strong className="font-medium text-foreground">فقط پس از</strong>{" "}
          تأیید پرداخت درگاه صادر می‌شود — خرید رایگان نیست.
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
          پرداخت را در درگاه با همین شناسه تکمیل کنید. سپس «بروزرسانی کارت‌ها» را
          بزنید تا کد نمایش داده شود.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            className="h-11 cursor-pointer"
            onClick={() => onSettledRefresh?.()}
          >
            <RefreshCw className="size-4" />
            بروزرسانی کارت‌ها
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 cursor-pointer"
            onClick={startAnother}
          >
            خرید جدید
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
      data-testid="gift-card-purchase-form"
    >
      <h2 className="flex items-center gap-2 font-serif text-2xl">
        <Gift className="size-5 text-primary" /> خرید کارت هدیه
      </h2>
      <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
        مبلغ کارت را انتخاب کنید. پس از پرداخت درگاه، کد در «کارت‌های من» ظاهر
        می‌شود — می‌توانید خودتان استفاده کنید یا کد را برای هدیه بفرستید.
      </p>

      <div className="mt-4">
        <Label className="mb-2 block">مبالغ پیشنهادی</Label>
        <div className="flex flex-wrap gap-2">
          {GIFT_CARD_PURCHASE_PRESETS.map((preset) => {
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
        <Label htmlFor="gift-card-purchase-custom">مبلغ دلخواه (تومان)</Label>
        <Input
          id="gift-card-purchase-custom"
          type="number"
          inputMode="numeric"
          min={GIFT_CARD_PURCHASE_MIN}
          max={GIFT_CARD_PURCHASE_MAX}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setAmount(null);
          }}
          placeholder={`${faNum(GIFT_CARD_PURCHASE_MIN)} – ${faNum(GIFT_CARD_PURCHASE_MAX)}`}
          dir="ltr"
          className="h-11 max-w-xs text-start"
        />
        <p className="text-xs text-muted-foreground">
          حداقل {formatPrice(GIFT_CARD_PURCHASE_MIN)} · حداکثر{" "}
          {formatPrice(GIFT_CARD_PURCHASE_MAX)}
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
        disabled={
          purchase.isPending || !isValidGiftCardPurchaseAmount(selected)
        }
        className="mt-5 h-11 cursor-pointer"
      >
        {purchase.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Gift className="size-4" />
        )}
        ثبت درخواست خرید
      </Button>
    </form>
  );
}
