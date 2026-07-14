import {
  CustomersView,
  type CustomersSearchParams,
} from "@/features/admin/customers/components/customers-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const resolvedSearchParams = await searchParams;
  return <CustomersView searchParams={resolvedSearchParams} />;
}
