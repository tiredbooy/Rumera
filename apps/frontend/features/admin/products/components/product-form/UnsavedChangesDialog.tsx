"use client";

import { TriangleAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function UnsavedChangesDialog({
  open,
  isSaving,
  hasPendingRetry,
  onStay,
  onDiscard,
}: {
  open: boolean;
  isSaving: boolean;
  hasPendingRetry: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert className="text-destructive" aria-hidden />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isSaving
              ? "ذخیره در حال انجام است"
              : hasPendingRetry
                ? "نتیجهٔ ذخیره هنوز مشخص نیست"
                : "تغییرات ذخیره نشده‌اند"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSaving
              ? "تا مشخص شدن نتیجهٔ ذخیره در این صفحه بمانید تا محصول نیمه‌کاره رها نشود."
              : hasPendingRetry
                ? "خروج از این صفحه بازیابی درخواست قبلی را به تعویق می‌اندازد. می‌توانید اکنون بمانید و دوباره تلاش کنید."
                : "با خروج از این صفحه، تغییرات فرم و تصاویر محلی از دست می‌روند."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>ادامهٔ ویرایش</AlertDialogCancel>
          {!isSaving ? (
            <AlertDialogAction variant="destructive" onClick={onDiscard}>
              خروج بدون ذخیره
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
