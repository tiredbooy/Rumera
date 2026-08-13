import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { SubscriptionsView } from "@/features/subscriptions/components/subscriptions-view";

export default function AccountSubscriptionsPage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="باکس فیزیکی"
        title="باکس سرداب"
        description="مدیریت باکس دوره‌ای — تاریخ ارسال بعدی، توقف موقت، رد یک دوره یا لغو. پرداخت خودکار در این مرحله انجام نمی‌شود."
      />
      <SubscriptionsView />
    </>
  );
}
