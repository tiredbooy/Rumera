import { RouteNotFound } from "@/components/route-state";

export default function NotFound() {
  return (
    <RouteNotFound
      as="main"
      title="این صفحه در رومرا نیست"
      description="نشانی واردشده درست نیست یا صفحه‌ای که می‌خواستید جابه‌جا شده است."
      primaryHref="/"
      primaryLabel="بازگشت به خانه"
      secondaryHref="/products"
      secondaryLabel="مشاهدهٔ محصولات"
      className="min-h-[70vh]"
    />
  );
}
