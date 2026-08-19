/**
 * The operator-facing line for a refused stock movement. Shared by the single
 * adjust popover and the bulk panel so both name the same cause with the same
 * words — a batch report that reads differently from the single path is how an
 * operator ends up retrying something that will never succeed.
 */
export function adjustErrorMessage(
  code: string | null | undefined,
  message?: string,
): string {
  switch (code) {
    case "OUT_OF_STOCK":
    case "INSUFFICIENT_STOCK":
      return "این مقدار مجاز نیست (مثلاً کمتر از رزرو). صفحه را تازه کنید و دوباره تلاش کنید.";
    case "NOT_FOUND":
      return "واریانت پیدا نشد.";
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "مقدار موجودی معتبر نیست.";
    default:
      return message || "ذخیرهٔ موجودی انجام نشد. دوباره تلاش کنید.";
  }
}
