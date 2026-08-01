"use client";

import {
  RouteError,
  type RouteErrorBoundaryProps,
} from "@/components/route-error";

export default function RecipesError(props: RouteErrorBoundaryProps) {
  return (
    <RouteError
      {...props}
      eyebrow="اختلال در دستورها"
      title="دستورها فعلاً در دسترس نیستند"
      description="دریافت دستورها کامل نشد. دوباره تلاش کنید یا محصولات فروشگاه را ببینید."
      navigationHref="/products"
      navigationLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
