import { BrandEditView } from "@/features/admin/brands/components/brand-edit-view";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminEditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  const { id } = await params;
  return <BrandEditView id={id} />;
}
