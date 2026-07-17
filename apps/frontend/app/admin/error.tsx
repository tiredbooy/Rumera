"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function AdminError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در پنل مدیریت"
      title="بارگذاری این بخش ناموفق بود"
      description="داده‌های مدیریتی این صفحه نمایش داده نشد. دوباره تلاش کنید یا از پنل خارج شوید."
      navigationHref="/"
      navigationLabel="بازگشت به فروشگاه"
      className="min-h-[32rem] max-w-none px-0 py-4"
    />
  );
}
