import { CustomerEditView } from "@/features/admin/customers/components/customer-edit-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_WRITE);
  const { id } = await params;
  return (
    <CustomerEditView targetUserId={id} currentUserId={session.user?.id} />
  );
}
