import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import DashboardBoard from "@/features/admin/analytics/components/DashboardBoard";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePermission(PERMISSIONS.ANALYTICS_READ);
  return <DashboardBoard searchParams={searchParams} />;
}
