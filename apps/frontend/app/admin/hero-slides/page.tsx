import Link from "next/link"
import { Plus } from "lucide-react"

import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { HeroSlidesBoard } from "@/features/admin/hero-slides/components/hero-slides-board"

export default async function AdminHeroSlidesPage() {
  const session = await requirePermission(PERMISSIONS.HERO_MANAGE)
  const canWrite = can(session, PERMISSIONS.HERO_MANAGE)

  return (
    <>
      <PageHeader
        title="بنر هیرو"
        description="اسلایدهای کاروسل صفحهٔ اصلی فروشگاه را مدیریت کنید."
        actions={
          canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/hero-slides/new">
                <Plus className="size-4" /> اسلاید جدید
              </Link>
            </Button>
          ) : null
        }
      />

      <HeroSlidesBoard canWrite={canWrite} />
    </>
  )
}
