import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { LoyaltyMembersView } from "@/features/admin/loyalty/components/loyalty-members-view";
import type { LoyaltyMemberSearchParams } from "@/features/admin/loyalty/types";
import { Button } from "@/components/ui/button";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<LoyaltyMemberSearchParams>;
}) {
  await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const params = await searchParams;

  return (
    <AdminPage
      title="باشگاه مشتریان"
      description="جستجو و پیگیری اعضای باشگاه. نرخ‌ها و سطوح امتیاز در تنظیمات برنامه است."
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/loyalty/programme">
            <SlidersHorizontal className="size-4" aria-hidden />
            تنظیمات برنامه
          </Link>
        </Button>
      }
    >
      <LoyaltyMembersView searchParams={params} />
    </AdminPage>
  );
}
