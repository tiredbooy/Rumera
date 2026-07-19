import { RouteNotFound } from "@/components/route-state";

export default function TagNotFound() {
  return (
    <RouteNotFound
      eyebrow="برچسب پیدا نشد"
      title="این برچسب در دسترس نیست"
      description="ممکن است برچسب حذف شده باشد یا نشانی آن درست نباشد. از فهرست برچسب‌ها مسیر دیگری انتخاب کنید."
      primaryHref="/tags"
      primaryLabel="مشاهدهٔ برچسب‌ها"
      secondaryHref="/products"
      secondaryLabel="همهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
