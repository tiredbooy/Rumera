import { RolesView } from "@/features/admin/roles/components/roles-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminRolesPage() {
  await requirePermission(PERMISSIONS.ROLES_MANAGE);
  return <RolesView />;
}
