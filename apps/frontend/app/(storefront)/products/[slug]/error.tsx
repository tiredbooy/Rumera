"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function ProductDetailError({
  error,
  unstable_retry,
}: RouteErrorBoundaryProps) {
  return (
    <RouteError
      error={error}
      unstable_retry={unstable_retry}
      eyebrow="اختلال در جزئیات محصول"
      title="این محصول فعلاً بارگذاری نشد"
      description="دریافت قیمت یا موجودی کامل نشد. دوباره تلاش کنید یا به فهرست محصولات برگردید."
      navigationHref="/products"
      navigationLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
