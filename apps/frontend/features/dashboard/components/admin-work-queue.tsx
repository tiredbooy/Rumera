import "server-only";

import {
  AlertTriangle,
  CreditCard,
  MessageSquare,
  PackageCheck,
  Receipt,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Permission } from "@/lib/rbac/permissions";
import {
  loadAdminWorkCounts,
  UNFULFILLED_STATUSES,
} from "../work-counts";
import { ModuleCard, type ModuleSummary } from "./module-card";

/**
 * S-1. The first screen of the day used to report revenue and then make the
 * operator open four other screens to find out whether anything was waiting.
 *
 * Every tile here is a task: a count of things needing action, linking to the
 * list already filtered to exactly those things. The counts come from each
 * list's own `pagination.total_items` with `limit: 1` — the filtered total is
 * computed by the query regardless of page size, so no counts endpoint is
 * needed and the number always matches the list the tile opens.
 */

export async function AdminWorkQueue({
  permissions,
}: {
  permissions: Permission[];
}) {
  const {
    pendingOrders,
    unfulfilled,
    failedPayments,
    pendingPayments,
    pendingReviews,
    lowStock,
  } = await loadAdminWorkCounts(permissions);

  const tiles: ModuleSummary[] = [];
  if (pendingOrders !== undefined) {
    tiles.push({
      label: "سفارش‌های در انتظار پرداخت",
      description: "ثبت شده و هنوز پرداخت نشده",
      href: "/admin/orders?status=pending",
      icon: Receipt,
      count: pendingOrders,
      urgent: true,
    });
  }
  if (unfulfilled !== undefined) {
    tiles.push({
      label: "پرداخت‌شده و ارسال‌نشده",
      description: "پرداخت شده، هنوز تحویل پست نشده",
      href: `/admin/orders?statuses=${encodeURIComponent(UNFULFILLED_STATUSES)}`,
      icon: PackageCheck,
      count: unfulfilled,
      urgent: true,
    });
  }
  if (failedPayments !== undefined) {
    tiles.push({
      label: "پرداخت‌های ناموفق",
      description: "سفارش‌هایی که پرداختشان شکست خورده",
      href: "/admin/orders?status=payment_failed",
      icon: CreditCard,
      count: failedPayments,
      urgent: true,
    });
  }
  if (pendingPayments !== undefined) {
    tiles.push({
      label: "پرداخت‌های در انتظار",
      description: "نیازمند تطبیق و پیگیری",
      href: "/admin/payments?status=pending",
      icon: CreditCard,
      count: pendingPayments,
      urgent: true,
    });
  }
  if (pendingReviews !== undefined) {
    tiles.push({
      label: "دیدگاه‌های در انتظار تأیید",
      description: "منتظر بررسی و انتشار",
      href: "/admin/reviews?status=pending",
      icon: MessageSquare,
      count: pendingReviews,
      urgent: true,
    });
  }
  if (lowStock !== undefined) {
    tiles.push({
      label: "موجودی رو به اتمام",
      description: "به نقطهٔ سفارش مجدد رسیده",
      href: "/admin/inventory?low_stock=true",
      icon: AlertTriangle,
      count: lowStock,
      urgent: true,
    });
  }

  if (tiles.length === 0) return null;

  return (
    <section aria-labelledby="work-queue-heading">
      <h2 id="work-queue-heading" className="text-sm font-medium">
        کارهای در انتظار
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <ModuleCard key={t.href} summary={t} />
        ))}
      </div>
    </section>
  );
}

export function AdminWorkQueueSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}
