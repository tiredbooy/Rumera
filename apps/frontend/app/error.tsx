"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function RootError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      as="main"
      error={error}
      unstable_retry={unstable_retry}
      title="نمایش این صفحه ممکن نشد"
      description="مشکلی پیش آمده است. دوباره تلاش کنید یا برای ادامه به صفحهٔ اصلی برگردید."
      navigationHref="/"
      navigationLabel="بازگشت به خانه"
      className="min-h-[70vh]"
    />
  );
}
