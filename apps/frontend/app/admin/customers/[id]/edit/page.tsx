import { CustomerEditView } from "@/features/admin/customers/components/customer-edit-view";
import { parseAdminUserID } from "@/features/customers/validations";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { notFound } from "next/navigation";

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_WRITE);
  const { id } = await params;
  const userID = parseAdminUserID(id);
  if (!userID) notFound();
  return (
    <CustomerEditView
      targetUserId={userID}
      currentUserId={session.user?.id}
      currentUserEmail={session.user?.email}
    />
  );
}
