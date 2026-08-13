import { LoyaltyProgrammeView } from "@/features/admin/loyalty/components/loyalty-programme-view";
import { getLoyaltyProgramme } from "@/features/admin/loyalty/api/server";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminLoyaltyPage() {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const programme = await getLoyaltyProgramme();
  return <LoyaltyProgrammeView programme={programme} />;
}
