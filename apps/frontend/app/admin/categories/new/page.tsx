import { CategoryCreateView } from "@/features/admin/categories/components/category-editor-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminNewCategoryPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  return <CategoryCreateView />;
}
