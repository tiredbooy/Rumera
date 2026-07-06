import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  Coins,
  TrendingUp,
  Wallet,
  Pencil,
  UserX,
} from "lucide-react";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { can } from "@/lib/rbac/can";
import { serverApi, ApiError } from "@/lib/api/client";
import type { UserAdminResponse } from "@/lib/api/admin-client";
import { formatPrice, faNum } from "@/lib/products";
import { faDate } from "@/lib/catalog/labels";
import {
  adminCustomers,
  ordersForCustomer,
  TIER_LABELS,
} from "@/lib/admin/data";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { StatCard } from "@/features/dashboard/components/stat-card";
import {
  PaymentBadge,
  FulfilmentBadge,
  UserStatusBadge,
  UserRoleBadge,
} from "@/components/admin/status-badge";

/** Small inline tag flagging a section as illustrative sample data, not live. */
function SampleNote() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
      نمونه
    </span>
  );
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.CUSTOMERS_READ);
  const { id } = await params;

  let user: UserAdminResponse | null = null;
  let notFoundUser = false;
  try {
    user = await serverApi<UserAdminResponse>(`/admin/users/${id}`);
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

  // Auxiliary sections below are illustrative sample data — there is no
  // per-customer orders / loyalty / wallet endpoint yet, so they render a
  // representative fixture clearly marked «نمونه» rather than faking live data.
  const sample = adminCustomers[0];
  const sampleOrders = ordersForCustomer(sample.id);
  const sampleAvgOrder = sample.ordersCount
    ? Math.round(sample.ltv / sample.ordersCount)
    : 0;

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

      {/* ─── Sample sections (no per-customer endpoints yet) ─────────────── */}
      <div className="mt-8 flex items-center gap-2">
        <h2 className="font-serif text-lg">فعالیت و باشگاه</h2>
        <SampleNote />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        داده‌های این بخش نمونه و صرفاً برای نمایش هستند؛ هنوز به سرویس واقعی
        سفارش‌ها و باشگاه مشتریان متصل نشده‌اند.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ارزش کل"
          value={formatPrice(sample.ltv)}
          icon={Coins}
        />
        <StatCard
          label="سفارش‌ها"
          value={faNum(sample.ordersCount)}
          icon={ShoppingBag}
        />
        <StatCard
          label="میانگین سبد"
          value={formatPrice(sampleAvgOrder)}
          icon={TrendingUp}
        />
        <StatCard
          label="کیف پول"
          value={formatPrice(sample.walletBalance)}
          icon={Wallet}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-serif text-lg">تاریخچهٔ سفارش‌ها</h3>
            <SampleNote />
          </div>
          <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
            {sampleOrders.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                سفارشی برای نمایش وجود ندارد.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      شماره
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      تاریخ
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      مبلغ
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      پرداخت
                    </TableHead>
                    <TableHead className="h-10 text-end text-xs font-medium text-muted-foreground">
                      ارسال
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleOrders.map((o) => (
                    <TableRow key={o.id} className="border-border/40">
                      <TableCell className="font-medium">
                        #{faNum(o.number)}
                      </TableCell>
                      <TableCell className="text-muted-foreground" dir="ltr">
                        {o.date}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(o.total)}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={o.payment} />
                      </TableCell>
                      <TableCell className="text-end">
                        <FulfilmentBadge status={o.fulfilment} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="border-hairline h-fit rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]">
          <div className="mb-4 flex items-center gap-2">
            <p className="font-serif text-base">باشگاه و کیف پول</p>
            <SampleNote />
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">سطح باشگاه</dt>
              <dd className="font-medium">{TIER_LABELS[sample.tier]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">موجودی کیف پول</dt>
              <dd className="font-medium">
                {formatPrice(sample.walletBalance)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">شهر</dt>
              <dd>{sample.city}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">آخرین بازدید</dt>
              <dd>{sample.lastSeen}</dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
}
