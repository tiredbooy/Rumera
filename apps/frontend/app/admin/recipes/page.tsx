import { requirePermission } from "@/lib/auth/session"
import { PERMISSIONS } from "@/lib/rbac/permissions"
import { can } from "@/lib/rbac/can"
import { faNum } from "@/lib/products"
import { adminRecipes } from "@/lib/admin/data"
import { PageHeader } from "@/components/dashboard/page-header"
import { RecipesBoard } from "@/components/admin/recipes-board"

export default async function AdminRecipesPage() {
  const session = await requirePermission(PERMISSIONS.RECIPES_READ)
  const canWrite = can(session, PERMISSIONS.RECIPES_WRITE)

  return (
    <>
      <PageHeader
        title="دستورها"
        description={`${faNum(adminRecipes.length)} دستور کوکتل و محتوای آموزشی`}
      />
      <RecipesBoard canWrite={canWrite} />
    </>
  )
}
