import Link from "next/link"
import { ArrowRight, User } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ)
  await params

  return (
    <>
      <PageHeader
        title="پروندهٔ مشتری"
        description="اطلاعات، سفارش‌ها و نقش کاربر."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/customers">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <Placeholder
        icon={User}
        title="پروندهٔ مشتری در انتظار اتصال به سرویس"
        description="GET /api/v1/admin/users/{id} — تغییر نقش از طریق PATCH /admin/users/{id} انجام می‌شود."
      />
    </>
  )
}
