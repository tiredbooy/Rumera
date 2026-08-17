import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { RecipesBoard } from "@/features/admin/recipes/components/RecipeBoard";

export default async function AdminRecipesPage() {
  const session = await requirePermission(PERMISSIONS.RECIPES_READ);
  // The board owns the page shell: it holds the filter bar and the pager.
  return <RecipesBoard canWrite={can(session, PERMISSIONS.RECIPES_WRITE)} />;
}
