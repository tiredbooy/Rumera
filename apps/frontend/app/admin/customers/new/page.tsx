import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserCreateForm } from "@/features/admin/customers/components/UserCreateForm";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminCreateUserPage() {
  await requirePermission(PERMISSIONS.CUSTOMERS_WRITE);

  return (
    <>
      <PageHeader
        eyebrow={
          <nav
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-label="مسیر"
          >
            <Link
              href="/admin/customers"
              className="transition-colors hover:text-foreground"
            >
              کاربران
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">کاربر جدید</span>
          </nav>
        }
        title="ساخت کاربر"
        description="ایجاد حساب مشتری، فروشنده یا مدیر با وضعیت اولیهٔ مشخص"
        actions={
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-11 cursor-pointer"
          >
            <Link href="/admin/customers">
              <ArrowRight className="size-4" aria-hidden />
              بازگشت
            </Link>
          </Button>
        }
      />
      <UserCreateForm />
    </>
  );
}
