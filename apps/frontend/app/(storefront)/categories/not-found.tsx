import { RouteNotFound } from "@/components/route-state";

export default function CategoryNotFound() {
  return (
    <RouteNotFound
      eyebrow="دسته‌بندی پیدا نشد"
      title="این دسته‌بندی در دسترس نیست"
      description="ممکن است دسته‌بندی حذف شده باشد یا نشانی آن درست نباشد. از فهرست دسته‌بندی‌ها مسیر دیگری انتخاب کنید."
      primaryHref="/categories"
      primaryLabel="مشاهدهٔ دسته‌بندی‌ها"
      secondaryHref="/products"
      secondaryLabel="همهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
