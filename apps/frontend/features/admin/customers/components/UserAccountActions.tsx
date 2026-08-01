"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, ShieldAlert, UserX } from "lucide-react";
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
  deactivateAdminUser,
  updateAdminUser,
} from "@/features/customers/client";

export function actionErrorMessage(error: unknown): string {
  if (!(error instanceof AdminCustomerApiError)) {
    return "عملیات ناموفق بود. دوباره تلاش کنید.";
  }
  if (error.code === "ACCESS_DENIED") {
    return "نقش یا وضعیت حساب خودتان قابل تغییر نیست.";
  }
  if (
    error.status === 401 ||
    error.code === "INSUFFICIENT_PERMISSIONS" ||
    error.code === "INVALID_TOKEN" ||
    error.code === "MISSING_TOKEN" ||
    error.code === "SESSION_EXPIRED"
  ) {
    return "دسترسی مدیریتی این نشست لغو یا منقضی شده است. دوباره وارد شوید.";
  }
  if (error.code === "AUTH_CHECK_UNAVAILABLE" || error.status === 502) {
    return "بررسی دسترسی مدیریتی موقتاً ممکن نیست. دوباره تلاش کنید.";
  }
  if (error.status === 403) return "اجازهٔ انجام این عملیات را ندارید.";
  if (error.status === 404 || error.code === "USER_NOT_FOUND") {
    return "کاربر یافت نشد.";
  }
  return error.message || "عملیات ناموفق بود.";
}

export function UserAccountActions({
  userID,
  displayName,
  isActive,
  isBanned,
  isSelf,
}: {
  userID: string;
  displayName: string;
  isActive: boolean;
  isBanned: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function deactivate() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await deactivateAdminUser(userID);
        setConfirmOpen(false);
        toast.success("حساب کاربر غیرفعال شد.");
        router.refresh();
      } catch (error) {
        const message = actionErrorMessage(error);
        setErrorMessage(message);
        toast.error(message);
      }
    });
  }

  if (isSelf) {
    return (
      <div
        className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-3.5 py-3 text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400"
        role="note"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-xs leading-relaxed">
          برای جلوگیری از قطع دسترسی، نمی‌توانید نقش یا وضعیت حساب خودتان را
          تغییر دهید.
        </p>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div
        className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-destructive ring-1 ring-inset ring-destructive/20"
        role="note"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-xs leading-relaxed">
          این حساب مسدود است. تغییر وضعیت فعال، مسدودی را برطرف نمی‌کند.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {isActive ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setErrorMessage(null);
            setConfirmOpen(true);
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
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-4" aria-hidden />
          )}
          {isPending ? "در حال فعال‌سازی…" : "فعال‌سازی دوباره"}
        </Button>
      )}

      {errorMessage && !confirmOpen ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isPending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>غیرفعال‌کردن حساب</AlertDialogTitle>
            <AlertDialogDescription>
              حساب «{displayName}» دیگر امکان ورود نخواهد داشت، اما اطلاعات و
              تاریخچهٔ آن حفظ می‌شود و بعداً قابل فعال‌سازی است.
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
              variant="destructive"
              size="lg"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                deactivate();
              }}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {isPending ? "در حال غیرفعال‌سازی…" : "تأیید غیرفعال‌سازی"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
