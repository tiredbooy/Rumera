import { RouteNotFound } from "@/components/route-state";

export default function AccountNotFound() {
  return (
    <RouteNotFound
      eyebrow="بخش حساب پیدا نشد"
      title="این اطلاعات در حساب شما نیست"
      description="ممکن است نشانی این بخش تغییر کرده باشد یا مورد درخواستی دیگر در دسترس نباشد."
      primaryHref="/account"
      primaryLabel="نمای کلی حساب"
      secondaryHref="/"
      secondaryLabel="بازگشت به فروشگاه"
      className="min-h-[30rem] max-w-none px-0 py-4"
    />
  );
}
