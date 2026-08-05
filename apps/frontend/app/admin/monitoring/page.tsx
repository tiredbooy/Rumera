import type { Metadata } from "next";

import { MonitoringBoard } from "@/features/admin/monitoring/components/MonitoringBoard";
import { requirePermission } from "@/lib/auth/session";
import { noindexMetadata } from "@/lib/seo/metadata";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = noindexMetadata("مانیتورینگ API");

export default async function AdminMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePermission(PERMISSIONS.ANALYTICS_READ);
  return <MonitoringBoard searchParams={searchParams} />;
}
