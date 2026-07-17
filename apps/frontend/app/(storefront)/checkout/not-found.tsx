import { RouteNotFound } from "@/components/route-state";

export default function CheckoutNotFound() {
  return (
    <RouteNotFound
      eyebrow="سفارش پیدا نشد"
      title="این مرحلهٔ تسویه حساب در دسترس نیست"
      description="نشانی سفارش یا تأییدیه معتبر نیست. برای بررسی اقلام و ادامهٔ خرید به سبد خرید برگردید."
      primaryHref="/cart"
      primaryLabel="بازگشت به سبد خرید"
      secondaryHref="/products"
      secondaryLabel="مشاهدهٔ محصولات"
      className="min-h-[32rem] max-w-none"
    />
  );
}
