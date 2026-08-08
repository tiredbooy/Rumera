import { ApiClientError } from "@/lib/api/store-client";

/** Map cart mutation failures to short Persian shopper copy. */
export function cartMutationErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return "افزودن به سبد ناموفق بود";
  }

  switch (error.code) {
    case "OUT_OF_STOCK":
      return "موجودی کافی نیست";
    case "PRODUCT_NOT_FOUND":
    case "NOT_FOUND":
      return "این محصول دیگر در دسترس نیست";
    case "PRODUCT_UNAVAILABLE":
      return "این گزینه فعلاً قابل خرید نیست";
    case "SESSION_EXPIRED":
    case "UNAUTHORIZED":
      return "نشست شما منقضی شده؛ دوباره وارد شوید";
    case "VALIDATION_ERROR":
    case "INVALID_BODY":
    case "INVALID_JSON":
      return "اطلاعات افزودن به سبد نامعتبر است";
    case "UPSTREAM_UNAVAILABLE":
      return "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید";
    case "FORBIDDEN_PATH":
      return "دسترسی به سبد خرید ممکن نیست";
    default:
      if (error.message && error.message !== error.code) {
        // Prefer a short known Persian message over raw English backend text.
        if (/[\u0600-\u06FF]/.test(error.message)) {
          return error.message;
        }
      }
      return "افزودن به سبد ناموفق بود";
  }
}
