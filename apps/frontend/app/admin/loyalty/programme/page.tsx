import Link from "next/link";
import { Users } from "lucide-react";

import { getLoyaltyProgramme } from "@/features/admin/loyalty/api/server";
import { LoyaltyProgrammeView } from "@/features/admin/loyalty/components/loyalty-programme-view";
import { Button } from "@/components/ui/button";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { ApiError } from "@/lib/api/errors";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const TITLE = "برنامهٔ باشگاه";
const DESCRIPTION =
  "نرخ‌ها و سطوح امتیاز مؤثر در این استقرار. تغییرات بلافاصله اعمال می‌شوند.";

const BREADCRUMB = [
  { label: "پنل مدیریت", href: "/admin" },
  { label: "باشگاه مشتریان", href: "/admin/loyalty" },
];

export default async function AdminLoyaltyProgrammePage() {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const canWrite = can(session, PERMISSIONS.CUSTOMERS_WRITE);

  let programme;
  try {
    programme = await getLoyaltyProgramme();
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <AdminPage
        breadcrumb={BREADCRUMB}
        title={TITLE}
        description={DESCRIPTION}
        width="default"
        action={<MembersLink />}
      >
        <AdminDataErrorState
          title="بارگذاری برنامهٔ باشگاه ناموفق بود"
          description="نرخ‌ها و سطوح امتیاز از سرور دریافت نشد. اتصال را بررسی کنید و دوباره تلاش کنید."
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      breadcrumb={BREADCRUMB}
      title={TITLE}
      description={DESCRIPTION}
      width="default"
      action={<MembersLink />}
    >
      <LoyaltyProgrammeView programme={programme} canWrite={canWrite} />
    </AdminPage>
  );
}

function MembersLink() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href="/admin/loyalty">
        <Users className="size-4" aria-hidden />
        اعضا
      </Link>
    </Button>
  );
}
