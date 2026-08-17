import { OptionTypeForm } from "@/features/admin/options/components/option-type-form";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminNewOptionPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);
  return (
    <>
      <PageHeader
        title="ویژگی جدید"
        description="ویژگی مشترک برای تنوع محصولات (مثل حجم)."
      />
      <OptionTypeForm mode="create" canWrite />
    </>
  );
}
