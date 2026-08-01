import { RouteNotFound } from "@/components/route-state";

export default function RecipeNotFound() {
  return (
    <RouteNotFound
      eyebrow="دستور پیدا نشد"
      title="این دستور در دسترس نیست"
      description="ممکن است دستور حذف شده باشد یا نشانی آن تغییر کرده باشد. از فهرست دستورها گزینهٔ دیگری را انتخاب کنید."
      primaryHref="/recipes"
      primaryLabel="بازگشت به دستورها"
      secondaryHref="/products"
      secondaryLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
