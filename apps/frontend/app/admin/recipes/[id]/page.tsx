import { RecipeEditView } from "@/features/admin/recipes/components/recipe-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminEditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.RECIPES_READ);
  const { id } = await params;
  return (
    <RecipeEditView
      id={id}
      canWrite={can(session, PERMISSIONS.RECIPES_WRITE)}
    />
  );
}
