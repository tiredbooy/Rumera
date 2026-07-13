import Link from "next/link";
import { ArrowRight, Pencil, UserX } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { ApiError } from "@/lib/api/client";
import { faDate } from "@/lib/utils/date";
import { getAdminUser } from "@/features/customers/api";
import type { AdminUser } from "@/features/customers/types";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import {
  UserStatusBadge,
  UserRoleBadge,
} from "@/components/admin/status-badge";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const { id } = await params;

  let user: AdminUser | null = null;
  let notFoundUser = false;
  try {
    user = await getAdminUser(id);
  } catch (e) {
    // GET /admin/users/:id filters to active users, so a deactivated account
    // resolves as 404 here. Surface a friendly state instead of crashing.
    if (e instanceof ApiError && e.status === 404) {
      notFoundUser = true;
    } else {
      throw e;
    }
  }

  const backButton = (
    <Button variant="outline" size="sm" asChild className="cursor-pointer">
      <Link href="/admin/customers">
        <ArrowRight className="size-4" /> بازگشت
      </Link>
    </Button>
  );

  if (notFoundUser || !user) {
    return (
      <>
        <PageHeader
          title="مشتری"
          description="کاربر در دسترس نیست"
          actions={backButton}
        />
        <div className="border-hairline flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            <UserX className="size-6" />
          </span>
          <p className="font-serif text-lg">این کاربر یافت نشد</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            ممکن است حساب حذف شده یا غیرفعال شده باشد. حساب‌های غیرفعال در این
            صفحه قابل مشاهده نیستند.
          </p>
          <Button asChild className="mt-2 cursor-pointer">
            <Link href="/admin/customers">بازگشت به فهرست مشتریان</Link>
          </Button>
        </div>
      </>
    );
  }

  const canWrite = can(session, PERMISSIONS.CUSTOMERS_WRITE);
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName = fullName || user.email;

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
              مشتریان
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">{displayName}</span>
          </nav>
        }
        title={displayName}
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            {canWrite ? (
              <Button size="sm" asChild className="cursor-pointer">
                <Link href={`/admin/customers/${user.user_id}/edit`}>
                  <Pencil className="size-4" /> ویرایش کاربر
                </Link>
              </Button>
            ) : null}
            {backButton}
          </div>
        }
      />

      {/* Live identity — sourced from GET /admin/users/:id */}
      <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-xl text-primary">
            {displayName.trim().charAt(0).toUpperCase()}
          </span>
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">نام</dt>
              <dd className="mt-1 font-medium">{fullName || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">ایمیل</dt>
              <dd className="mt-1 truncate font-medium" dir="ltr">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">نقش</dt>
              <dd className="mt-1">
                <UserRoleBadge role={user.role} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">وضعیت</dt>
              <dd className="mt-1">
                <UserStatusBadge active={user.is_active} />
              </dd>
            </div>
            {user.phone ? (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">تلفن</dt>
                <dd className="mt-1 font-medium tabular-nums" dir="ltr">
                  {user.phone}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-muted-foreground">تاریخ عضویت</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {faDate(user.created_at)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
}
