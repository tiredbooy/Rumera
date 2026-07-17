"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function AccountError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در حساب کاربری"
      title="بارگذاری حساب کاربری ناموفق بود"
      description="اطلاعات حساب شما نمایش داده نشد. دوباره تلاش کنید یا با بازگشت به فروشگاه از این بخش خارج شوید."
      navigationHref="/"
      navigationLabel="بازگشت به فروشگاه"
      className="min-h-[30rem] max-w-none px-0 py-4"
    />
  );
}
