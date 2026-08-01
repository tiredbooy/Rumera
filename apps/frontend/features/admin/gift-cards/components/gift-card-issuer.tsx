"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Copy,
  Download,
  Gift,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { GiftCardApiError } from "@/features/gift-cards/api/admin-client";
import { useCreateGiftCards } from "@/features/gift-cards/hooks";
import type { AdminGiftCard } from "@/features/gift-cards/types";
import { formatPaymentAmount } from "@/features/payments/presentation";
import { faNum } from "@/lib/products";
import { faDateTime } from "@/lib/utils/date";

import {
  giftCardIssuanceSchema,
  MAX_GIFT_CARD_BATCH_SIZE,
  toCreateGiftCardsInput,
  type GiftCardIssuanceValues,
} from "../validations";

const FORM_FIELDS = new Set<keyof GiftCardIssuanceValues>(["amount", "count"]);

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function GiftCardIssuer() {
  const issueCards = useCreateGiftCards();
  const resultsHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const [cards, setCards] = React.useState<AdminGiftCard[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GiftCardIssuanceValues>({
    resolver: zodResolver(giftCardIssuanceSchema),
    defaultValues: { amount: "", count: "1" },
  });
  const busy = isSubmitting || issueCards.isPending;

  React.useEffect(() => {
    if (cards.length > 0) resultsHeadingRef.current?.focus();
  }, [cards]);

  async function submit(values: GiftCardIssuanceValues) {
    setFormError(null);
    try {
      const issued = await issueCards.mutateAsync(
        toCreateGiftCardsInput(values),
      );
      setCards(issued);
      toast.success(`${faNum(issued.length)} کارت هدیه صادر شد`);
    } catch (error) {
      const staleResultNote = cards.length
        ? " کدهای نمایش‌داده‌شده مربوط به آخرین دستهٔ موفق هستند."
        : "";
      if (error instanceof GiftCardApiError) {
        let focused = false;
        for (const [key, messages] of Object.entries(error.fields ?? {})) {
          if (!FORM_FIELDS.has(key as keyof GiftCardIssuanceValues)) continue;
          setError(
            key as keyof GiftCardIssuanceValues,
            { message: messages[0] },
            { shouldFocus: !focused },
          );
          focused = true;
        }
        setFormError(`${error.message}${staleResultNote}`);
        toast.error(error.message);
        return;
      }
      setFormError(
        `صدور دستهٔ جدید ناموفق بود؛ هیچ کارت تازه‌ای تأیید نشده است.${staleResultNote}`,
      );
      toast.error("صدور کارت‌های هدیه ناموفق بود");
    }
  }

  async function copyText(text: string, code?: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(code ?? "all");
      toast.success(code ? "کد کارت کپی شد" : "همهٔ کدها کپی شدند");
      window.setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      toast.error("کپی کدها ناموفق بود");
    }
  }

  function downloadCSV() {
    const rows = [
      ["code", "initial_amount", "status", "created_at"],
      ...cards.map((card) => [
        card.code,
        card.initial_amount,
        card.status,
        card.created_at,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rumera-gift-cards-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="صدور کارت هدیه"
        description="یک یا چند کد یک‌بارمصرف با مبلغ یکسان صادر کنید. کدها فقط در پاسخ همین عملیات برگردانده می‌شوند."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/payments">
              <ReceiptText className="size-4" aria-hidden /> تراکنش‌های پرداخت
            </Link>
          </Button>
        }
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <section
          aria-labelledby="gift-card-form-title"
          className="border-hairline self-start rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
        >
          <div className="mb-5">
            <h2 id="gift-card-form-title" className="font-serif text-lg">
              مشخصات دسته
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              هر دسته حداکثر {faNum(MAX_GIFT_CARD_BATCH_SIZE)} کد دارد و در سمت
              سرور به‌صورت یک عملیات کامل صادر می‌شود.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(submit)}
            className="space-y-5"
            noValidate
          >
            {formError ? (
              <p
                role="alert"
                className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                {formError}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="gift-card-amount">مبلغ هر کارت (تومان)</Label>
              <FieldControl
                id="gift-card-amount"
                error={errors.amount?.message}
                description={!errors.amount}
              >
                <Input
                  id="gift-card-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  dir="ltr"
                  placeholder="برای نمونه 500000"
                  className="h-11"
                  {...register("amount")}
                />
              </FieldControl>
              {errors.amount?.message ? (
                <p
                  id={fieldErrorId("gift-card-amount")}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.amount.message}
                </p>
              ) : (
                <p
                  id={fieldDescriptionId("gift-card-amount")}
                  className="text-xs text-muted-foreground"
                >
                  مبلغ باید مثبت و حداکثر دارای دو رقم اعشار باشد.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gift-card-count">تعداد کارت</Label>
              <FieldControl
                id="gift-card-count"
                error={errors.count?.message}
                description={!errors.count}
              >
                <Input
                  id="gift-card-count"
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  className="h-11"
                  {...register("count")}
                />
              </FieldControl>
              {errors.count?.message ? (
                <p
                  id={fieldErrorId("gift-card-count")}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.count.message}
                </p>
              ) : (
                <p
                  id={fieldDescriptionId("gift-card-count")}
                  className="text-xs text-muted-foreground"
                >
                  عددی بین ۱ تا {faNum(MAX_GIFT_CARD_BATCH_SIZE)} وارد کنید.
                </p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Gift className="size-4" aria-hidden />
              )}
              {busy ? "در حال صدور دسته…" : "صدور کارت‌ها"}
            </Button>
          </form>
        </section>

        <section
          aria-labelledby="gift-card-results-title"
          className="border-hairline min-w-0 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="gift-card-results-title"
                ref={resultsHeadingRef}
                tabIndex={-1}
                className="rounded-md font-serif text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                کدهای صادرشده
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                این فهرست پس از خروج یا تازه‌سازی صفحه قابل بازیابی نیست؛ همین
                حالا آن را ذخیره کنید.
              </p>
            </div>
            {cards.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyText(cards.map((card) => card.code).join("\n"))
                  }
                >
                  {copiedCode === "all" ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                  کپی همه
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadCSV}
                >
                  <Download className="size-4" aria-hidden /> دریافت CSV
                </Button>
              </div>
            ) : null}
          </div>

          {cards.length === 0 ? (
            <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
              <Gift className="size-10 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-serif text-lg">
                هنوز کارتی صادر نشده است
              </p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                پس از صدور موفق، کدهای واقعی همراه مبلغ و زمان ایجاد در اینجا
                نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <>
              <div
                role="status"
                className="mt-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"
              >
                {faNum(cards.length)} کارت فعال با موفقیت صادر شد. پیش از صدور
                دستهٔ بعدی، کدها را کپی یا دریافت کنید.
              </div>
              <ol className="mt-4 grid max-h-[36rem] min-w-0 gap-3 overflow-y-auto pe-1 sm:grid-cols-2">
                {cards.map((card) => (
                  <li
                    key={card.code}
                    className="min-w-0 rounded-xl bg-muted/45 p-4 ring-1 ring-border/60"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <code
                        className="min-w-0 break-all font-mono text-sm font-semibold"
                        dir="ltr"
                      >
                        {card.code}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label={`کپی کد ${card.code}`}
                        onClick={() => void copyText(card.code, card.code)}
                      >
                        {copiedCode === card.code ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <Copy className="size-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {formatPaymentAmount(card.initial_amount, "IRT")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {faDateTime(card.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </>
  );
}
