import "server-only";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminUser, getAdminUserAudit } from "@/features/customers/api";
import { UserRoleBadge } from "@/features/customers/components/user-role-badge";
import { UserStatusBadge } from "@/features/customers/components/user-status-badge";
import type {
  AdminUser,
  AdminUserAuditEvent,
} from "@/features/customers/types";
import { AdminDataErrorState } from "@/features/dashboard/components/admin-data-error-state";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/errors";
import type { Paginated } from "@/lib/api/types";
import { faDate } from "@/lib/utils/date";

import { UserAccountActions } from "./UserAccountActions";
import { UserAuditHistory } from "./user-audit-history";
import { WalletCreditForm } from "./wallet-credit-form";

const AUDIT_PAGE_SIZE = 20;

export async function CustomerDetailView({
  id,
  currentUserId,
  currentUserEmail,
  auditPage,
  canCreditWallet = false,
}: {
  id: string;
  currentUserId?: string;
  currentUserEmail?: string | null;
  auditPage: number;
  /** customers:write — wallet top-up affordance */
  canCreditWallet?: boolean;
}) {
  let user: AdminUser;
  try {
    user = await getAdminUser(id);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 404 || error.status === 422)
    ) {
      notFound();
    }
    throw error;
  }

  const backButton = (
    <Button variant="outline" size="sm" asChild className="h-11 cursor-pointer">
      <Link href="/admin/customers">
        <ArrowRight className="size-4" aria-hidden /> بازگشت
      </Link>
    </Button>
  );

  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const displayName = fullName || user.email;
  const isSelf =
    (!!currentUserId && currentUserId === user.user_id) ||
    (!!currentUserEmail && currentUserEmail === user.email);
  let audit: Paginated<AdminUserAuditEvent> | null = null;
  try {
    audit = await getAdminUserAudit(user.user_id, {
      page: auditPage,
      limit: AUDIT_PAGE_SIZE,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      throw error;
    }
    // Keep live identity/actions available if only the audit request fails.
  }
  if (audit && auditPage > audit.pagination.total_pages) {
    redirect(
      audit.pagination.total_pages > 1
        ? `/admin/customers/${user.user_id}?audit_page=${audit.pagination.total_pages}`
        : `/admin/customers/${user.user_id}`,
    );
  }

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
            <span className="break-all text-foreground">{displayName}</span>
          </nav>
        }
        title={displayName}
        description={user.email}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" asChild className="h-11 cursor-pointer">
              <Link href={`/admin/customers/${user.user_id}/edit`}>
                <Pencil className="size-4" aria-hidden /> ویرایش کاربر
              </Link>
            </Button>
            {backButton}
          </div>
        }
      />

      {/* Live identity sourced from GET /admin/users/:id. */}
      <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-xl text-primary"
            aria-hidden
          >
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
                <UserStatusBadge
                  active={user.is_active}
                  banned={user.is_banned}
                />
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

        <section
          className="mt-5 flex flex-col gap-4 border-t border-border/50 pt-5 sm:flex-row sm:items-start sm:justify-between"
          aria-labelledby="account-status-title"
        >
          <div className="max-w-xl">
            <h2 id="account-status-title" className="text-sm font-medium">
              کنترل وضعیت حساب
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {user.is_banned
                ? "این حساب مسدود است و حتی در حالت فعال امکان ورود ندارد. رفع مسدودی در قرارداد فعلی مدیریت کاربران پشتیبانی نمی‌شود."
                : "غیرفعال‌سازی دسترسی ورود را متوقف می‌کند، اما حساب، جزئیات و تاریخچه را حذف نمی‌کند. حساب غیرفعال در همین صفحه قابل مشاهده و فعال‌سازی دوباره است."}
            </p>
          </div>
          <UserAccountActions
            userID={user.user_id}
            displayName={displayName}
            isActive={user.is_active}
            isBanned={user.is_banned}
            isSelf={isSelf}
          />
        </section>
      </div>

      {canCreditWallet ? (
        <div className="mt-6">
          <WalletCreditForm
            userId={user.user_id}
            userLabel={displayName}
            canCredit
          />
        </div>
      ) : null}

      {audit ? (
        <UserAuditHistory
          userID={user.user_id}
          events={audit.results}
          pagination={audit.pagination}
        />
      ) : (
        <section className="mt-6" aria-labelledby="user-audit-title">
          <h2 id="user-audit-title" className="mb-3 font-serif text-lg">
            تاریخچهٔ مدیریتی
          </h2>
          <AdminDataErrorState
            title="دریافت تاریخچه ناموفق بود"
            description="هیچ رویداد جایگزینی نمایش داده نشده است. اتصال را بررسی کنید و دوباره تلاش کنید."
          />
        </section>
      )}
    </>
  );
}
