import { RouteNotFound } from "@/components/route-state";

export default function AdminNotFound() {
  return (
    <RouteNotFound
      eyebrow="بخش مدیریتی پیدا نشد"
      title="این رکورد یا صفحه در دسترس نیست"
      description="ممکن است مورد درخواستی حذف شده باشد یا نشانی آن تغییر کرده باشد. به داشبورد مدیریت برگردید."
      primaryHref="/admin"
      primaryLabel="بازگشت به داشبورد"
      secondaryHref="/"
      secondaryLabel="رفتن به فروشگاه"
      className="min-h-[32rem] max-w-none px-0 py-4"
    />
  );
}
