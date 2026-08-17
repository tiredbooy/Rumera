import { OptionsBoard } from "@/features/admin/options/components/options-board";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminOptionsPage() {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  return <OptionsBoard canWrite={can(session, PERMISSIONS.PRODUCTS_WRITE)} />;
}
