import { OptionsBoard } from "@/features/admin/options/components/options-board";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminOptionsPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  return <OptionsBoard />;
}
