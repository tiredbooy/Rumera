import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { BrandForm } from "@/features/admin/brands/components/BrandForm";

export default async function AdminNewBrandPage() {
  await requirePermission(PERMISSIONS.PRODUCTS_WRITE);

  return (
    <>
      <PageHeader
        title="برند جدید"
        description="یک سازنده یا برند تازه به کاتالوگ اضافه کنید."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/brands">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <BrandForm mode="create" submitLabel="افزودن برند" />
    </>
  );
}
