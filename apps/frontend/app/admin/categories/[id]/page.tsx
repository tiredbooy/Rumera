import { CategoryEditView } from "@/features/admin/categories/components/category-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";

export default async function AdminEditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id } = await params;
  return (
    <CategoryEditView
      id={id}
      canWrite={can(session, PERMISSIONS.PRODUCTS_WRITE)}
    />
  );
}
