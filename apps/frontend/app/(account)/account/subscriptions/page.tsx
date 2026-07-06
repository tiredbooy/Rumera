import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { SubscriptionsView } from "@/features/subscriptions/components/subscriptions-view";

export default function AccountSubscriptionsPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="باکس دوره‌ای"
        title="اشتراک‌ها"
        description="باکس دوره‌ای رومرا را مدیریت کنید — توقف، رد کردن یا لغو در هر زمان."
      />
      <SubscriptionsView />
    </>
  );
}
