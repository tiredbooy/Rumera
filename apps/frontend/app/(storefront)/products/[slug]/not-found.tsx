import { RouteNotFound } from "@/components/route-state";

export default function ProductDetailNotFound() {
  return (
    <RouteNotFound
      eyebrow="محصول پیدا نشد"
      title="این محصول در دسترس نیست"
      description="ممکن است محصول غیرفعال شده باشد یا نشانی آن درست نباشد. از فروشگاه محصول دیگری انتخاب کنید."
      primaryHref="/products"
      primaryLabel="مشاهدهٔ محصولات"
      secondaryHref="/"
      secondaryLabel="بازگشت به خانه"
      className="min-h-[65vh]"
    />
  );
}
