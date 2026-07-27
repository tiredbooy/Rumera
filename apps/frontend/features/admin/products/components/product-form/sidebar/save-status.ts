export type ProductSavePhase =
  | "idle"
  | "preparing"
  | "saving"
  | "saved"
  | "recoverable"
  | "conflict"
  | "error";

export function productSaveStatus(
  phase: ProductSavePhase,
  mode: "create" | "edit",
  hasUnsavedChanges: boolean,
) {
  switch (phase) {
    case "preparing":
      return "در حال آماده‌سازی و بارگذاری تصاویر…";
    case "saving":
      return "در حال ثبت یکپارچهٔ محصول…";
    case "saved":
      return "همهٔ تغییرات ذخیره شد";
    case "recoverable":
      return "نتیجهٔ ذخیره نامشخص است؛ درخواست قبلی قابل بازیابی است";
    case "conflict":
      return "نسخهٔ تازه‌تری از محصول ثبت شده است";
    case "error":
      return "ذخیره کامل نشد؛ موارد مشخص‌شده را بررسی کنید";
    default:
      if (hasUnsavedChanges) return "تغییرات ذخیره‌نشده دارید";
      return mode === "create"
        ? "اطلاعات محصول را تکمیل کنید"
        : "فرم با آخرین نسخهٔ ذخیره‌شده هماهنگ است";
  }
}

export function productSaveAction(
  phase: ProductSavePhase,
  hasPendingRetry: boolean,
) {
  if (hasPendingRetry) return "تلاش دوباره";
  if (phase === "preparing") return "آماده‌سازی…";
  if (phase === "saving") return "در حال ذخیره…";
  return "ذخیره";
}
