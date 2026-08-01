import { RouteNotFound } from "@/components/route-state";

export default function JournalNotFound() {
  return (
    <RouteNotFound
      eyebrow="نوشته پیدا نشد"
      title="این نوشته در دسترس نیست"
      description="ممکن است نوشته حذف شده باشد یا نشانی آن تغییر کرده باشد. از ژورنال نوشتهٔ دیگری را انتخاب کنید."
      primaryHref="/journal"
      primaryLabel="بازگشت به ژورنال"
      secondaryHref="/products"
      secondaryLabel="مشاهدهٔ محصولات"
      className="min-h-[65vh]"
    />
  );
}
