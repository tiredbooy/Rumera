import Link from "next/link";
import { ArrowRight, UserX } from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { serverApi, ApiError } from "@/lib/api/client";
import type { UserAdminResponse } from "@/lib/api/admin-client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { UserEditForm } from "@/features/admin/customers/components/UserEditForm";

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_WRITE);
  const { id } = await params;

  let user: UserAdminResponse | null = null;
  let notFoundUser = false;
  try {
    user = await serverApi<UserAdminResponse>(`/admin/users/${id}`);
  } catch (e) {
    // GET /admin/users/:id filters to active users, so a deactivated account
    // resolves as 404 here. Surface a friendly state instead of a hard 404 page.
    if (e instanceof ApiError && e.status === 404) {
      notFoundUser = true;
    } else {
      throw e;
    }
  }

  const backButton = (
    <Button variant="outline" size="sm" asChild>
      <Link href="/admin/customers">
        <ArrowRight className="size-4" /> بازگشت
      </Link>
    </Button>
  );

  if (notFoundUser || !user) {
    return (
      <>
        <PageHeader
          title="ویرایش کاربر"
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
          <Button asChild className="mt-2">
            <Link href="/admin/customers">بازگشت به فهرست مشتریان</Link>
          </Button>
        </div>
      </>
    );
  }

  const isSelf = !!session.user?.id && session.user.id === user.user_id;
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

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
            <span className="text-foreground">{fullName || user.email}</span>
          </nav>
        }
        title="ویرایش کاربر"
        description={fullName || user.email}
        actions={backButton}
      />
      <UserEditForm user={user} isSelf={isSelf} />
    </>
  );
}
