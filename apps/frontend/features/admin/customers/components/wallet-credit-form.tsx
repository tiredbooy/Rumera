"use client";

import * as React from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api/store-client";
import { faNum, formatPrice } from "@/lib/products";

/**
 * Admin wallet top-up for a customer (Task 083a).
 * Calls POST /api/admin/admin/users/:id/wallet/credit
 */
export function WalletCreditForm({
  userId,
  userLabel,
}: {
  userId: string;
  userLabel: string;
}) {
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("مبلغ باید عددی بزرگ‌تر از صفر باشد");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/admin/users/${encodeURIComponent(userId)}/wallet/credit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: value,
            description: description.trim() || undefined,
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
      toast.success("موجودی کیف پول افزایش یافت", {
        description: `${formatPrice(value)} برای ${userLabel}`,
      });
      setAmount("");
      setDescription("");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message || "افزایش موجودی ناموفق بود"
          : "افزایش موجودی ناموفق بود",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
      data-testid="wallet-credit-form"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Wallet className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-lg">افزایش موجودی کیف پول</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            مبلغ به‌صورت دستی به کیف پول {userLabel} واریز می‌شود.
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
          />
          {amount && Number(amount) > 0 ? (
            <p className="text-xs text-muted-foreground">
              معادل {faNum(Number(amount))} تومان
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
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          واریز به کیف پول
        </Button>
      </div>
    </form>
  );
}
