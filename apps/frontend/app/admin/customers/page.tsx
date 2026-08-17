import {
  CustomersView,
  type CustomersSearchParams,
} from "@/features/admin/customers/components/customers-view";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const resolvedSearchParams = await searchParams;
  return (
    <CustomersView
      searchParams={resolvedSearchParams}
      canWrite={can(session, PERMISSIONS.CUSTOMERS_WRITE)}
    />
  );
}
