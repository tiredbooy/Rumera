import "server-only";

import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Gift,
  Tags,
  TicketPercent,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { listTags } from "@/features/catalog/tags/api/public";
import { listAdminCoupons } from "@/features/coupons/api/server";
import { listUsers } from "@/features/customers/api";
import { listAdminPayments } from "@/features/payments/api/admin";
import { listShippingZones } from "@/features/shipping/api/server";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import { faNum } from "@/lib/products";

type CountState = number | null | undefined;

type ModuleSummary = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  count?: number | null;
  action?: string;
};

async function loadCount(
  allowed: boolean,
  loader: () => Promise<number>,
): Promise<CountState> {
  if (!allowed) return undefined;
  try {
    return await loader();
  } catch {
    return null;
  }
}

function ModuleCard({ summary }: { summary: ModuleSummary }) {
  const Icon = summary.icon;
  const unavailable = summary.count === null;
  const value =
    summary.action ??
    (summary.count === null ? "—" : faNum(summary.count ?? 0));

  return (
    <Link
      href={summary.href}
      className="group border-hairline flex min-h-40 min-w-0 flex-col rounded-2xl bg-card p-5 outline-none ring-1 ring-foreground/[0.04] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-e1 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
      aria-label={`${summary.label}: ${unavailable ? "آمار در دسترس نیست" : value}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <ArrowLeft
          className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
          aria-hidden
        />
      </div>
      <p className="mt-4 font-serif text-xl leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium">{summary.label}</p>
      <p
        className={
          unavailable
            ? "mt-1 text-xs text-destructive"
            : "mt-1 text-xs leading-5 text-muted-foreground"
        }
      >
        {unavailable ? "دریافت شمارش ناموفق بود" : summary.description}
      </p>
    </Link>
  );
}

export async function AdminModuleOverview({
  permissions,
}: {
  permissions: Permission[];
}) {
  const session = { permissions };
  const [customers, tags, coupons, shippingZones, pendingPayments] =
    await Promise.all([
      loadCount(can(session, PERMISSIONS.CUSTOMERS_READ), async () => {
        const result = await listUsers({ page: 1, limit: 1 });
        return result.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.TAGS_MANAGE), async () => {
        const result = await listTags({ page: 1, limit: 1 });
        return result.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.COUPONS_MANAGE), async () => {
        const result = await listAdminCoupons({
          page: 1,
          limit: 1,
          active_only: true,
        });
        return result.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.SHIPPING_MANAGE), async () => {
        const result = await listShippingZones({
          page: 1,
          limit: 1,
          is_active: true,
        });
        return result.pagination.total_items;
      }),
      loadCount(can(session, PERMISSIONS.PAYMENTS_READ), async () => {
        const result = await listAdminPayments({
          page: 1,
          limit: 1,
          status: "pending",
        });
        return result.pagination.total_items;
      }),
    ]);

  const summaries: ModuleSummary[] = [];
  if (customers !== undefined) {
    summaries.push({
      label: "کاربران",
      description: "کل حساب‌های ثبت‌شده",
      href: "/admin/customers",
      icon: Users,
      count: customers,
    });
  }
  if (pendingPayments !== undefined) {
    summaries.push({
      label: "پرداخت‌های در انتظار",
      description: "نیازمند تطبیق و پیگیری",
      href: "/admin/payments?status=pending",
      icon: CreditCard,
      count: pendingPayments,
    });
  }
  if (coupons !== undefined) {
    summaries.push({
      label: "کدهای تخفیف فعال",
      description: "فعال در بازهٔ فعلی",
      href: "/admin/coupons?status=current",
      icon: TicketPercent,
      count: coupons,
    });
  }
  if (shippingZones !== undefined) {
    summaries.push({
      label: "مناطق ارسال فعال",
      description: "محدوده‌های قابل انتخاب",
      href: "/admin/shipping?status=active",
      icon: Truck,
      count: shippingZones,
    });
  }
  if (tags !== undefined) {
    summaries.push({
      label: "برچسب‌ها",
      description: "برچسب‌های قابل انتساب",
      href: "/admin/tags",
      icon: Tags,
      count: tags,
    });
  }
  if (can(session, PERMISSIONS.GIFT_CARDS_ISSUE)) {
    summaries.push({
      label: "کارت هدیه",
      description: "صدور دستهٔ کدهای یک‌بارمصرف",
      href: "/admin/gift-cards",
      icon: Gift,
      action: "صدور",
    });
  }

  if (summaries.length === 0) return null;

  return (
    <section aria-labelledby="admin-modules-title">
      <div className="mb-3">
        <h2 id="admin-modules-title" className="font-serif text-lg">
          دسترسی سریع عملیاتی
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          شمارش زنده و مسیر مستقیم ماژول‌هایی که اکنون آمادهٔ استفاده‌اند.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary) => (
          <ModuleCard key={summary.href} summary={summary} />
        ))}
      </div>
    </section>
  );
}

export function AdminModuleOverviewSkeleton() {
  return (
    <section aria-label="در حال بارگذاری دسترسی‌های سریع" role="status">
      <Skeleton className="mb-2 h-5 w-40" />
      <Skeleton className="mb-3 h-3 w-72 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
    </section>
  );
}
