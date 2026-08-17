"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2, RotateCcw, ShieldAlert, ShieldOff, UserX } from "lucide-react";
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
import {
  AdminCustomerApiError,
  banAdminUser,
  deactivateAdminUser,
  unbanAdminUser,
  updateAdminUser,
} from "@/features/customers/client";
import { apiErrorMessage } from "@/lib/api/user-facing-error";

type ConfirmKind = "deactivate" | "ban" | "unban";

const CONFIRM_COPY: Record<
  ConfirmKind,
  {
    title: string;
    description: (name: string) => string;
    confirm: string;
    pending: string;
    destructive: boolean;
  }
> = {
  deactivate: {
    title: "غیرفعال‌کردن حساب",
    description: (name) =>
      `حساب «${name}» دیگر امکان ورود نخواهد داشت، اما اطلاعات و تاریخچهٔ آن حفظ می‌شود و بعداً قابل فعال‌سازی است.`,
    confirm: "تأیید غیرفعال‌سازی",
    pending: "در حال غیرفعال‌سازی…",
    destructive: true,
  },
  ban: {
    title: "مسدود کردن حساب",
    description: (name) =>
      `حساب «${name}» دیگر امکان ورود نخواهد داشت و نشست‌های فعال باطل می‌شوند. این عمل بعداً با رفع مسدودی قابل بازگشت است.`,
    confirm: "تأیید مسدودسازی",
    pending: "در حال مسدودسازی…",
    destructive: true,
  },
  unban: {
    title: "رفع مسدودی حساب",
    description: (name) =>
      `مسدودی حساب «${name}» برداشته می‌شود. کاربر باید دوباره وارد شود. حساب غیرفعال به‌صورت خودکار فعال نمی‌شود.`,
    confirm: "تأیید رفع مسدودی",
    pending: "در حال رفع مسدودی…",
    destructive: false,
  },
};

export function actionErrorMessage(
  error: unknown,
  action?: ConfirmKind,
): string {
  if (error instanceof AdminCustomerApiError) {
    // Self-lockout: more specific than generic ACCESS_DENIED map.
    if (error.code === "ACCESS_DENIED") {
      if (action === "ban" || action === "unban") {
        return "حساب خودتان قابل مسدودسازی یا رفع مسدودی نیست.";
      }
      return "نقش یا وضعیت حساب خودتان قابل تغییر نیست.";
    }
    if (error.code === "CONFLICT" || error.status === 409) {
      if (action === "ban") {
        return "نمی‌توان آخرین مدیر فعال را مسدود کرد. ابتدا مدیر دیگری بسازید.";
      }
      return "نمی‌توان آخرین مدیر فعال را غیرفعال کرد. ابتدا مدیر دیگری بسازید.";
    }
    if (error.code === "AUTH_CHECK_UNAVAILABLE" || error.status === 502) {
      return "بررسی دسترسی مدیریتی موقتاً ممکن نیست. دوباره تلاش کنید.";
    }
  }
  return apiErrorMessage(error, "عملیات ناموفق بود. دوباره تلاش کنید.");
}

export function UserAccountActions({
  userID,
  displayName,
  isActive,
  isBanned,
  isSelf,
  canWrite,
  canBan = false,
}: {
  userID: string;
  displayName: string;
  isActive: boolean;
  isBanned: boolean;
  isSelf: boolean;
  /** customers:write — deactivate / reactivate */
  canWrite: boolean;
  /** customers:ban — ban / unban (not customers:write) */
  canBan?: boolean;
}) {
  const router = useRouter();
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(
    kind: ConfirmKind,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await action();
        setConfirmKind(null);
        toast.success(success);
        router.refresh();
      } catch (error) {
        const message = actionErrorMessage(error, kind);
        setErrorMessage(message);
        toast.error(message);
      }
    });
  }

  function reactivate() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await updateAdminUser(userID, { is_active: true });
        toast.success("حساب کاربر دوباره فعال شد.");
        router.refresh();
      } catch (error) {
        const message = actionErrorMessage(error);
        setErrorMessage(message);
        toast.error(message);
      }
    });
  }

  function confirmAction() {
    if (confirmKind === "deactivate") {
      runAction(
        "deactivate",
        () => deactivateAdminUser(userID),
        "حساب کاربر غیرفعال شد.",
      );
      return;
    }
    if (confirmKind === "ban") {
      runAction("ban", () => banAdminUser(userID), "حساب کاربر مسدود شد.");
      return;
    }
    if (confirmKind === "unban") {
      runAction(
        "unban",
        () => unbanAdminUser(userID),
        "مسدودی حساب برداشته شد.",
      );
    }
  }

  if (!canWrite && !canBan) {
    return null;
  }

  if (isSelf) {
    return (
      <div
        className="flex items-start gap-2.5 rounded-xl bg-warning/12 px-3.5 py-3 text-warning ring-1 ring-inset ring-warning/25"
        role="note"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-xs leading-relaxed">
          برای جلوگیری از قطع دسترسی، نمی‌توانید نقش، وضعیت یا مسدودی حساب
          خودتان را تغییر دهید.
        </p>
      </div>
    );
  }

  const showBannedWriteNote = isBanned && canWrite && !canBan;
  const confirm = confirmKind ? CONFIRM_COPY[confirmKind] : null;

  return (
    <div className="flex flex-col items-start gap-2">
      {showBannedWriteNote ? (
        <div
          className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-destructive ring-1 ring-inset ring-destructive/20"
          role="note"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs leading-relaxed">
            این حساب مسدود است. تغییر وضعیت فعال، مسدودی را برطرف نمی‌کند.
          </p>
        </div>
      ) : null}

      {canWrite && !isBanned ? (
        isActive ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setErrorMessage(null);
              setConfirmKind("deactivate");
            }}
            className="h-11 cursor-pointer"
          >
            <UserX className="size-4" aria-hidden />
            غیرفعال‌کردن حساب
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={reactivate}
            className="h-11 cursor-pointer"
          >
            {isPending && confirmKind === null ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-4" aria-hidden />
            )}
            {isPending && confirmKind === null
              ? "در حال فعال‌سازی…"
              : "فعال‌سازی دوباره"}
          </Button>
        )
      ) : null}

      {canBan && !isBanned ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setErrorMessage(null);
            setConfirmKind("ban");
          }}
          className="h-11 cursor-pointer"
        >
          <Ban className="size-4" aria-hidden />
          مسدود کردن حساب
        </Button>
      ) : null}

      {canBan && isBanned ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setErrorMessage(null);
            setConfirmKind("unban");
          }}
          className="h-11 cursor-pointer"
        >
          <ShieldOff className="size-4" aria-hidden />
          رفع مسدودی
        </Button>
      ) : null}

      {errorMessage && !confirmKind ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <AlertDialog
        open={confirmKind !== null}
        onOpenChange={(open) => {
          if (!isPending && !open) setConfirmKind(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? confirm.description(displayName) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel size="lg" disabled={isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.destructive ? "destructive" : "default"}
              size="lg"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmAction();
              }}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {isPending ? confirm?.pending : confirm?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
