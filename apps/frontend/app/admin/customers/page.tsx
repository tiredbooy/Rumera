import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { faNum } from "@/lib/products"
import { adminCustomers } from "@/lib/admin/data"
import { PageHeader } from "@/components/dashboard/page-header"
import { CustomersTable } from "@/components/admin/customers-table"

export default async function AdminCustomersPage() {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ)

  return (
    <>
      <PageHeader
        title="مشتریان"
        description={`${faNum(adminCustomers.length)} مشتری ثبت‌شده`}
      />
      <CustomersTable />
    </>
  )
}
