"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function CheckoutError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در تسویه حساب"
      title="ادامهٔ تسویه حساب ممکن نشد"
      description="اطلاعات لازم برای تکمیل سفارش دریافت نشد. دوباره تلاش کنید یا به سبد خرید برگردید."
      navigationHref="/cart"
      navigationLabel="بازگشت به سبد خرید"
      className="min-h-[32rem] max-w-none"
    />
  );
}
