import "server-only";

import Link from "next/link";
import { ShieldCheck, UserCog, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminRoles } from "@/features/customers/api";
import type { AdminAuthorizationSummary } from "@/features/customers/types";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { AdminPage } from "@/features/dashboard/components/admin-page";
import { ApiError } from "@/lib/api/errors";
import { CapabilityMatrix } from "@/features/admin/roles/components/capability-matrix";
import { faNum } from "@/lib/products";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils";

const ROLE_DESC: Record<Role, string> = {
  customer: "حساب خرید و خدمات شخصی؛ بدون دسترسی به پنل مدیریت.",
  vendor: "حساب فروشنده؛ در وضعیت فعلی بدون دسترسی به پنل مدیریت.",
  admin: "سوپریوزر پنل؛ همهٔ قابلیت‌ها و امکان مدیریت ماتریس دسترسی.",
  staff:
    "اپراتور پنل با گرنت‌های محدود؛ فقط سطوحی که در ماتریس اعطا شده‌اند.",
};

export async function RolesView() {
  let summary: AdminAuthorizationSummary;
  try {
    summary = await getAdminRoles();
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    return (
      <AdminPage
        title="نقش‌ها و دسترسی پنل"
        description="نمای زندهٔ مدل دسترسی و تعداد اعضای هر نقش"
      >
        <AdminDataErrorState
          title="دریافت نقش‌ها ناموفق بود"
          description="هیچ شمارش یا نقش جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
        />
      </AdminPage>
    );
  }

  const adminRoles = new Set(summary.admin_roles);
  const isCapabilityMode =
    summary.authorization_mode === "role_capabilities";

  return (
    <AdminPage
      title="نقش‌ها و دسترسی پنل"
      description="نمای زندهٔ مدل دسترسی و تعداد اعضای هر نقش"
    >
      <section
        className="border-hairline mb-6 flex flex-col gap-4 rounded-2xl bg-primary/[0.06] p-5 ring-1 ring-primary/10 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-labelledby="authorization-model-title"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="authorization-model-title" className="font-serif text-lg">
              {isCapabilityMode
                ? "مدل نقش + قابلیت فعال است"
                : "مدل دسترسی پنل"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {isCapabilityMode
                ? "نقش «مدیر کل» سوپریوزر است و نقش «اپراتور» فقط با گرنت‌های ماتریس وارد سطوح مجاز می‌شود. API و ناوبری هر دو از همین ماتریس پیروی می‌کنند."
                : "هر کاربر یک نقش دارد؛ نقش‌های مجاز پنل در admin_roles فهرست شده‌اند."}
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="cursor-pointer sm:shrink-0">
          <Link href="/admin/customers">
            <UserCog className="size-4" aria-hidden />
            مدیریت نقش کاربران
          </Link>
        </Button>
      </section>

      <CapabilityMatrix />

      <section aria-labelledby="roles-summary-title" className="mt-8">
        <h2 id="roles-summary-title" className="mb-3 font-serif text-lg">
          خلاصهٔ نقش‌ها
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.roles.map((item) => {
            const hasAdminAccess =
              item.admin_access && adminRoles.has(item.role);
            const unavailableCount = Math.max(
              0,
              item.member_count - item.active_member_count,
            );
            const label = ROLE_LABELS[item.role] ?? item.role;
            const desc = ROLE_DESC[item.role] ?? "";

            return (
              <article
                key={item.role}
                className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]"
                aria-labelledby={`role-${item.role}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl ring-1 ring-inset",
                      hasAdminAccess
                        ? "bg-primary/10 text-primary ring-primary/15"
                        : "bg-muted text-muted-foreground ring-border/60",
                    )}
                  >
                    {hasAdminAccess ? (
                      <ShieldCheck className="size-4.5" aria-hidden />
                    ) : (
                      <Users className="size-4.5" aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      "inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                      hasAdminAccess
                        ? "bg-success/12 text-success ring-success/25"
                        : "bg-muted text-muted-foreground ring-border/60",
                    )}
                  >
                    {hasAdminAccess ? "ورود به پنل مجاز" : "بدون دسترسی به پنل"}
                  </span>
                </div>

                <h3
                  id={`role-${item.role}`}
                  className="mt-4 font-serif text-lg"
                >
                  {label}
                </h3>
                <p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">
                  {desc}
                </p>

                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border/50 pt-4 text-center">
                  <div>
                    <dt className="text-[0.6875rem] text-muted-foreground">
                      کل اعضا
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {faNum(item.member_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] text-muted-foreground">
                      فعال
                    </dt>
                    <dd className="mt-1 font-medium text-success tabular-nums">
                      {faNum(item.active_member_count)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.6875rem] text-muted-foreground">
                      غیرفعال/مسدود
                    </dt>
                    <dd className="mt-1 font-medium text-muted-foreground tabular-nums">
                      {faNum(unavailableCount)}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </AdminPage>
  );
}
