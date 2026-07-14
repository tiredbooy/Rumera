import { RecipeEditView } from "@/features/admin/recipes/components/recipe-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminEditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.RECIPES_READ);
  const { id } = await params;
  return <RecipeEditView id={id} />;
}
