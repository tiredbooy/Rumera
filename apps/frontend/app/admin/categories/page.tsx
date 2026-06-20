import Link from "next/link"
import { Plus } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { CategoriesTable } from "@/components/admin/categories-table"

export default async function AdminCategoriesPage() {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ)
  const canWrite = can(session, PERMISSIONS.PRODUCTS_WRITE)

  return (
    <>
      <PageHeader
        title="دسته‌بندی‌ها"
        description="ساختار درختی دسته‌بندی‌های کاتالوگ را مدیریت کنید."
        actions={
          canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/categories/new">
                <Plus className="size-4" /> دسته‌بندی جدید
              </Link>
            </Button>
          ) : null
        }
      />

      <CategoriesTable canWrite={canWrite} />
    </>
  )
}
