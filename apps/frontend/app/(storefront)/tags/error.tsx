"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function TagsError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در برچسب‌ها"
      title="برچسب‌ها فعلاً در دسترس نیستند"
      description="دریافت این مجموعه کامل نشد. دوباره تلاش کنید یا به فهرست همهٔ محصولات بروید."
      navigationHref="/products"
      navigationLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
