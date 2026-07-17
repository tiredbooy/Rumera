"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function StorefrontError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در فروشگاه"
      title="فروشگاه فعلاً پاسخ نمی‌دهد"
      description="دریافت محتوای این صفحه کامل نشد. دوباره تلاش کنید یا به ویترین فروشگاه برگردید."
      navigationHref="/"
      navigationLabel="بازگشت به فروشگاه"
      className="min-h-[65vh]"
    />
  );
}
