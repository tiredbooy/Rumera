"use client";

import * as React from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newGiftCardIdempotencyKey } from "@/features/gift-cards/api/account";
import { useRedeemGiftCard } from "@/features/gift-cards/hooks";
import { formatPrice } from "@/lib/products";
import { apiErrorToast } from "@/lib/api/user-facing-error";

/**
 * Gift-card redeem (PH-042b polish): single-use code → full face amount to wallet.
 * Sends Idempotency-Key; domain status remains ultimate truth against double-credit.
 */
export function GiftCardRedeem() {
  const redeem = useRedeemGiftCard();
  const [code, setCode] = React.useState("");
  const idemRef = React.useRef(newGiftCardIdempotencyKey("gcr"));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    redeem.mutate(
      { code: trimmed, idempotencyKey: idemRef.current },
      {
        onSuccess: (res) => {
          setCode("");
          idemRef.current = newGiftCardIdempotencyKey("gcr");
          toast.success("کارت هدیه اعمال شد", {
            description: `${formatPrice(res.amount)} به کیف پول شما افزوده شد.`,
          });
        },
        onError: (err) => {
          const t = apiErrorToast(err, "استفاده از کارت هدیه ناموفق بود");
          toast.error(t.title, { description: t.description });
        },
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
      data-testid="gift-card-redeem-form"
    >
      <h2 className="flex items-center gap-2 font-serif text-2xl">
        <Gift className="size-5 text-primary" /> استفاده از کارت
      </h2>
      <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
        کد کارت هدیه را وارد کنید. هر کد{" "}
        <strong className="font-medium text-foreground">یک‌بار</strong> کل مبلغ
        روی کارت را به کیف پول می‌افزاید — موجودی جزئی قابل مشاهده نیست.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor="gift-card-code">کد کارت هدیه</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="gift-card-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 text-start tracking-widest"
          />
          <Button
            type="submit"
            disabled={redeem.isPending || !code.trim()}
            className="h-11 cursor-pointer"
          >
            {redeem.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Gift className="size-4" />
            )}
            اعمال
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          کد نامعتبر، قبلاً استفاده‌شده یا غیرفعال رد می‌شود.
        </p>
      </div>
    </form>
  );
}
