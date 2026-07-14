import { AdminSettingsView } from "@/features/admin/settings/components/admin-settings-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  return <AdminSettingsView />;
}
