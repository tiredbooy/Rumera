"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2 } from "lucide-react";
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
import { toAsciiDigits } from "@/lib/normalize-digits";
import { apiErrorToast } from "@/lib/api/user-facing-error";
import { faNum } from "@/lib/products";

import { adjustLoyaltyPoints } from "../api/client";
import { signedPoints } from "../labels";

/**
 * Admin grant / clawback for Cellar Club points (PR-003b).
 *
 * - Capability gate: hidden without customers:write
 * - Confirmation dialog before POST
 * - Client-generated idempotency key (stable per pending adjust)
 * - UUID :userID — same as WalletCreditForm / /admin/customers/:id
 */
export function LoyaltyAdjustForm({
  userId,
  userLabel,
  canAdjust = true,
}: {
  userId: string;
  userLabel: string;
  /** When false the form is not rendered (server capability gate). */
  canAdjust?: boolean;
}) {
  const router = useRouter();
  const [delta, setDelta] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [idempotencyKey, setIdempotencyKey] = React.useState(() =>
    newIdempotencyKey(),
  );

  if (!canAdjust) {
    return null;
  }

  const parsedDelta = parseDelta(delta);
  const deltaValid = parsedDelta !== null;

  function openConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (parsedDelta === null) {
      toast.error("مقدار تغییر باید عدد صحیح غیرصفر باشد");
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmAdjust() {
    if (parsedDelta === null) {
      setConfirmOpen(false);
      return;
    }
    setPending(true);
    try {
      const data = await adjustLoyaltyPoints(userId, {
        delta: parsedDelta,
        note: note.trim() || undefined,
        idempotencyKey,
      });
      const replayed = Boolean(data.replayed);
      const grant = parsedDelta > 0;
      toast.success(
        replayed
          ? "این تنظیم قبلاً ثبت شده بود"
          : grant
            ? "امتیاز اهدا شد"
            : "امتیاز برگشت داده شد",
        {
          description: `${signedPoints(parsedDelta)} برای ${userLabel}`,
        },
      );
      setDelta("");
      setNote("");
      setIdempotencyKey(newIdempotencyKey());
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      const t = apiErrorToast(error, "تنظیم امتیاز ناموفق بود");
      toast.error(t.title, { description: t.description });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form
        onSubmit={openConfirm}
        className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
        data-testid="loyalty-adjust-form"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Award className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-lg">تنظیم امتیاز</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              مقدار مثبت اهدا می‌کند و lifetime را افزایش می‌دهد. مقدار منفی تا
              سقف موجودی برمی‌گرداند و lifetime را کم نمی‌کند. از کلید یکتای
              درخواست برای جلوگیری از تکرار استفاده می‌شود.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="loyalty-adjust-user">شناسهٔ کاربر (UUID)</Label>
            <Input
              id="loyalty-adjust-user"
              value={userId}
              readOnly
              dir="ltr"
              className="font-mono text-xs"
              data-testid="loyalty-adjust-user-id"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="loyalty-adjust-delta">مقدار تغییر (دلتا)</Label>
            <Input
              id="loyalty-adjust-delta"
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="۵۰ یا ‎-۳۰"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              disabled={pending}
              required
              data-testid="loyalty-adjust-delta"
            />
            {deltaValid && parsedDelta !== null ? (
              <p className="text-xs text-muted-foreground">
                {parsedDelta > 0
                  ? `${faNum(parsedDelta)} امتیاز اهدا می‌شود`
                  : `${faNum(Math.abs(parsedDelta))} امتیاز برگشت داده می‌شود`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="loyalty-adjust-note">یادداشت (اختیاری)</Label>
            <Textarea
              id="loyalty-adjust-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
              placeholder="مثلاً جبران تأخیر ارسال"
              maxLength={400}
              data-testid="loyalty-adjust-note"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            disabled={pending || !deltaValid}
            className="h-11"
            data-testid="loyalty-adjust-submit"
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
        <AlertDialogContent data-testid="loyalty-adjust-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {parsedDelta !== null && parsedDelta < 0
                ? "تأیید برگشت امتیاز"
                : "تأیید اهدا امتیاز"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {parsedDelta !== null
                ? parsedDelta > 0
                  ? `${faNum(parsedDelta)} امتیاز به حساب «${userLabel}» اضافه می‌شود.`
                  : `${faNum(Math.abs(parsedDelta))} امتیاز از حساب «${userLabel}» کسر می‌شود. امتیاز lifetime کاهش نمی‌یابد.`
                : "مقدار نامعتبر است."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              disabled={pending}
              data-testid="loyalty-adjust-cancel"
            >
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={pending || !deltaValid}
              data-testid="loyalty-adjust-confirm-action"
              onClick={(event) => {
                event.preventDefault();
                void confirmAdjust();
              }}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : parsedDelta !== null && parsedDelta < 0 ? (
                "بله، برگردانده شود"
              ) : (
                "بله، اهدا شود"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function parseDelta(raw: string): number | null {
  const trimmed = toAsciiDigits(raw).trim().replace(/,/g, "").replace(/^\+/, "");
  if (!/^-?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value === 0) return null;
  return value;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `la-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}