import { CustomerDetailView } from "@/features/admin/customers/components/customer-detail-view";
import type { UserDetailSearchParams } from "@/features/customers/types";
import { notFound } from "next/navigation";
import {
  parseAdminUserID,
  parseUserAuditPage,
} from "@/features/customers/validations";
import { can } from "@/lib/rbac/can";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<UserDetailSearchParams>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const { id } = await params;
  const userID = parseAdminUserID(id);
  if (!userID) notFound();
  const auditPage = parseUserAuditPage(await searchParams);
  return (
    <CustomerDetailView
      id={userID}
      currentUserId={session.user?.id}
      currentUserEmail={session.user?.email}
      auditPage={auditPage}
      canWrite={can(session, PERMISSIONS.CUSTOMERS_WRITE)}
      canCreditWallet={can(session, PERMISSIONS.WALLET_CREDIT)}
      canBan={can(session, PERMISSIONS.CUSTOMERS_BAN)}
    />
  );
}
