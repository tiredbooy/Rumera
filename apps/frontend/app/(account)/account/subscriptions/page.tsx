import { PageHeader } from "@/components/dashboard/page-header"
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view"

export default function AccountSubscriptionsPage() {
  return (
    <>
      <PageHeader
        title="اشتراک‌ها"
        description="باکس دوره‌ای رومرا را مدیریت کنید — توقف، رد کردن یا لغو در هر زمان."
      />
      <SubscriptionsView />
    </>
  )
}
