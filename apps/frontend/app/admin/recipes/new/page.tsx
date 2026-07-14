import { RecipeCreateView } from "@/features/admin/recipes/components/recipe-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminNewRecipePage() {
  await requirePermission(PERMISSIONS.RECIPES_WRITE);
  return <RecipeCreateView />;
}
