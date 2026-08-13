"use client";

import * as React from "react";
import { Copy, Gift, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

import { useMyGiftCards } from "./hooks";
import type { GiftCardStatus, PurchasedGiftCard } from "./types";

function statusLabel(status: GiftCardStatus): string {
  switch (status) {
    case "active":
      return "فعال";
    case "redeemed":
      return "استفاده‌شده";
    case "disabled":
      return "غیرفعال";
    default:
      return status;
  }
}

function statusTone(status: GiftCardStatus): string {
  switch (status) {
    case "active":
      return "bg-primary/10 text-primary ring-primary/20";
    case "redeemed":
      return "bg-muted text-muted-foreground ring-foreground/10";
    case "disabled":
      return "bg-destructive/10 text-destructive ring-destructive/20";
    default:
      return "bg-muted text-muted-foreground ring-foreground/10";
  }
}

function CardRow({ card }: { card: PurchasedGiftCard }) {
  function copyCode() {
    void navigator.clipboard?.writeText(card.code).then(
      () => toast.success("کد کارت هدیه کپی شد"),
      () => toast.error("کپی ناموفق بود"),
    );
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-2xl bg-muted/30 p-4 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:justify-between"
      data-testid="gift-card-mine-row"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-sm tracking-wider text-foreground hover:text-primary"
            dir="ltr"
            title="کپی کد"
          >
            {card.code}
            <Copy className="size-3.5 shrink-0" aria-hidden />
          </button>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs ring-1",
              statusTone(card.status),
            )}
          >
            {statusLabel(card.status)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          مبلغ روی کارت:{" "}
          <strong className="font-medium text-foreground" dir="ltr">
            {formatPrice(Number(card.initial_amount))}
          </strong>
          {card.status === "active" ? (
            <span className="ms-1">· قابل استفاده یک‌باره</span>
          ) : null}
        </p>
        {card.purchase_txid ? (
          <p className="truncate font-mono text-xs text-muted-foreground" dir="ltr">
            {card.purchase_txid}
          </p>
        ) : null}
      </div>
      {card.status === "active" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 cursor-pointer"
          onClick={copyCode}
        >
          <Copy className="size-3.5" />
          کپی کد
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Self-delivery list of codes the customer purchased (PH-042b).
 * Face amount is the single-use balance (no partial redeem API).
 */
export function GiftCardMine() {
  const mine = useMyGiftCards();

  return (
    <section
      className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
      data-testid="gift-card-mine"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <Gift className="size-5 text-primary" /> کارت‌های من
          </h2>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            کد کارت‌هایی که از درگاه خریده‌اید. کد را کپی کنید و خودتان در بخش
            «استفاده از کارت» وارد کنید یا برای هدیه بفرستید.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 cursor-pointer"
          onClick={() => void mine.refetch()}
          disabled={mine.isFetching}
        >
          {mine.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          بروزرسانی
        </Button>
      </div>

      {mine.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          در حال بارگذاری…
        </p>
      ) : null}

      {mine.isError ? (
        <div className="mt-4 rounded-2xl bg-destructive/5 p-4 text-sm text-destructive ring-1 ring-destructive/15">
          <p>بارگذاری کارت‌ها ناموفق بود.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-9 cursor-pointer"
            onClick={() => void mine.refetch()}
          >
            تلاش مجدد
          </Button>
        </div>
      ) : null}

      {!mine.isLoading && !mine.isError && (mine.data?.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          هنوز کارت هدیه خریداری‌شده‌ای ندارید. پس از پرداخت موفق، کد اینجا ظاهر
          می‌شود.
        </p>
      ) : null}

      {(mine.data?.length ?? 0) > 0 ? (
        <ul className="mt-4 space-y-3">
          {mine.data!.map((card) => (
            <CardRow key={`${card.code}-${card.created_at}`} card={card} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
