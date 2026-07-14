import { CategoryEditView } from "@/features/admin/categories/components/category-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminEditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id } = await params;
  return <CategoryEditView id={id} />;
}
