import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { AlertsView } from "@/features/product-alerts/components/alerts-view";

export default function AccountAlertsPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="اعلان‌ها"
        title="اعلان‌های محصول"
        description="خبر موجود شدن دوباره یا کاهش قیمت تنوع‌هایی که دنبال می‌کنید."
      />
      <AlertsView />
    </>
  );
}
