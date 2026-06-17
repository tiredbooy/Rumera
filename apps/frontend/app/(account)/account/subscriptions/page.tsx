import { AccountPageHeader } from "@/components/account/account-page-header"
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view"

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
  )
}
