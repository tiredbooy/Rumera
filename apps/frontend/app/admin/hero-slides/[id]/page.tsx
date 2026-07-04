import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { HeroEditLoader } from "@/features/admin/hero-slides/components/hero-edit-loader";

export default async function AdminEditHeroSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.HERO_MANAGE);
  const { id } = await params;

  const slideId = Number(id);
  if (!Number.isInteger(slideId) || slideId <= 0) notFound();

  return (
    <>
      <PageHeader
        title="ویرایش اسلاید"
        description="محتوا، تصویر و وضعیت نمایش این بنر را به‌روزرسانی کنید."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/hero-slides">
              <ArrowRight className="size-4" /> بازگشت
            </Link>
          </Button>
        }
      />
      <HeroEditLoader id={slideId} />
    </>
  );
}
