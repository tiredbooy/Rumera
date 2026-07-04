import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { RecipesBoard } from "@/features/admin/recipes/components/RecipeBoard";

export default async function AdminRecipesPage() {
  const session = await requirePermission(PERMISSIONS.RECIPES_READ);
  const canWrite = can(session, PERMISSIONS.RECIPES_WRITE);

  return (
    <>
      <PageHeader
        title="دستورها"
        description="دستورهای کوکتل و محتوای آموزشی فروشگاه"
        actions={
          canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/recipes/new">
                <Plus className="size-4" /> دستور جدید
              </Link>
            </Button>
          ) : null
        }
      />
      <RecipesBoard canWrite={canWrite} />
    </>
  );
}
