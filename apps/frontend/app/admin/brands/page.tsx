import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { BrandsTable } from "@/features/admin/brands/components/BrandsTable";

export default async function AdminBrandsPage() {
  // Brands sit under the catalogue; gated by the same key as their nav entry.
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const canWrite = can(session, PERMISSIONS.PRODUCTS_WRITE);
  const canDelete = can(session, PERMISSIONS.PRODUCTS_DELETE);

  return (
    <>
      <PageHeader
        title="برندها"
        description="سازندگان و برندهای موجود در کاتالوگ را مدیریت کنید."
        actions={
          canWrite ? (
            <Button size="sm" asChild>
              <Link href="/admin/brands/new">
                <Plus className="size-4" /> برند جدید
              </Link>
            </Button>
          ) : null
        }
      />

      <BrandsTable canWrite={canWrite} canDelete={canDelete} />
    </>
  );
}
