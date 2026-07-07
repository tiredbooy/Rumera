import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { AnalyticsView } from "@/features/admin/analytics/components/AnalyticsView";

export default async function AdminAnalyticsPage() {
  await requirePermission(PERMISSIONS.ANALYTICS_READ);

  return (
    <>
      <PageHeader
        title="تحلیل‌ها"
        description="عملکرد فروش بر پایهٔ داده‌های زنده."
      />
      <AnalyticsView />
    </>
  );
}
