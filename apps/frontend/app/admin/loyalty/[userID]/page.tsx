import { notFound } from "next/navigation";

import { LoyaltyMemberDetailView } from "@/features/admin/loyalty/components/loyalty-member-detail-view";
import type { LoyaltyMemberDetailSearchParams } from "@/features/admin/loyalty/types";
import {
  parseLoyaltyLedgerFilters,
  parseLoyaltyMemberUserID,
} from "@/features/admin/loyalty/validations";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminLoyaltyMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ userID: string }>;
  searchParams: Promise<LoyaltyMemberDetailSearchParams>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const { userID } = await params;
  const id = parseLoyaltyMemberUserID(userID);
  if (!id) notFound();
  const ledger = parseLoyaltyLedgerFilters(await searchParams);
  return (
    <LoyaltyMemberDetailView
      userID={id}
      ledgerPage={ledger.page}
      ledgerReason={ledger.reason}
      canAdjust={can(session, PERMISSIONS.CUSTOMERS_WRITE)}
    />
  );
}