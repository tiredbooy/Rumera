import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { PageHeader } from "@/components/dashboard/page-header"
import { AnalyticsView } from "@/components/admin/analytics-view"

export default async function AdminAnalyticsPage() {
  await requirePermission(PERMISSIONS.ANALYTICS_READ)

  return (
    <>
      <PageHeader title="تحلیل‌ها" description="عملکرد فروش بر پایهٔ داده‌های زنده." />
      <AnalyticsView />
    </>
  )
}
