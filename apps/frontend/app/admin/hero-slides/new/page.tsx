import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { HeroForm } from "@/features/admin/hero-slides/components/hero-form";

export default async function AdminNewHeroSlidePage() {
  await requirePermission(PERMISSIONS.HERO_MANAGE);

  return (
    <>
      <PageHeader
        title="اسلاید جدید"
        description="یک بنر تازه برای کاروسل صفحهٔ اصلی بسازید."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/hero-slides">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <HeroForm mode="create" submitLabel="افزودن اسلاید" />
    </>
  );
}
