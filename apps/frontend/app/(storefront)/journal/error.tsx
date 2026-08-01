"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function JournalError(props: RouteErrorBoundaryProps) {
  return (
    <RouteError
      {...props}
      eyebrow="اختلال در ژورنال"
      title="نوشته‌های ژورنال فعلاً در دسترس نیستند"
      description="دریافت نوشته‌ها کامل نشد. دوباره تلاش کنید یا به فروشگاه برگردید."
      navigationHref="/products"
      navigationLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
