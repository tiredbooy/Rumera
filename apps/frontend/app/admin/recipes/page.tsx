import { BookOpen, Plus } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"

export default async function AdminRecipesPage() {
  const session = await requirePermission(PERMISSIONS.RECIPES_READ)
  const canWrite = can(session, PERMISSIONS.RECIPES_WRITE)

  return (
    <>
      <PageHeader
        title="دستورها"
        description="مدیریت دستورهای کوکتل و محتوای آموزشی."
        actions={
          canWrite ? (
            <Button size="sm">
              <Plus className="size-4" /> دستور جدید
            </Button>
          ) : null
        }
      />
      <Placeholder
        icon={BookOpen}
        title="فهرست دستورها در انتظار اتصال به سرویس"
        description="GET /api/v1/recipes — دستورها اینجا فهرست و قابل ویرایش می‌شوند (ویرایشگر TipTap موجود است)."
      />
    </>
  )
}
