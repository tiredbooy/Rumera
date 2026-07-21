"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function CategoriesError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در دسته‌بندی‌ها"
      title="دسته‌بندی‌ها فعلاً در دسترس نیستند"
      description="دریافت مسیرهای دسته‌بندی کامل نشد. دوباره تلاش کنید یا همهٔ محصولات را ببینید."
      navigationHref="/products"
      navigationLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
