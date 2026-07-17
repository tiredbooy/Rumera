import { RouteNotFound } from "@/components/route-state";

export default function StorefrontNotFound() {
  return (
    <RouteNotFound
      title="صفحهٔ موردنظر پیدا نشد"
      description="ممکن است این محصول یا مطلب دیگر منتشر نشده باشد. از فهرست محصولات مسیر تازه‌ای انتخاب کنید."
      primaryHref="/products"
      primaryLabel="مشاهدهٔ محصولات"
      secondaryHref="/"
      secondaryLabel="بازگشت به فروشگاه"
      className="min-h-[65vh]"
    />
  );
}
