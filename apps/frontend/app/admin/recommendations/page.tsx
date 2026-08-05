import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRecommendationOpsStats } from "@/features/recommendations/admin-api";
import { getTrending } from "@/features/recommendations/api";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { DashboardErrorState } from "@/features/dashboard/components/async-state";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { faNum, formatPrice } from "@/lib/products";

const TYPE_LABELS: Record<string, string> = {
  view: "مشاهده",
  search_click: "کلیک جستجو",
  recipe_view: "مشاهدهٔ دستور",
  add_to_cart: "افزودن به سبد",
  wishlist: "علاقه‌مندی",
  review: "دیدگاه",
  purchase: "خرید",
};

/**
 * Operator surface for recommendation health: live interaction aggregates from
 * the backend plus a short guide. Does not invent personalization scores.
 */
export default async function AdminRecommendationsPage() {
  await requirePermission(PERMISSIONS.ANALYTICS_READ);

  let statsError: string | null = null;
  let stats: Awaited<ReturnType<typeof getRecommendationOpsStats>> | null =
    null;
  try {
    stats = await getRecommendationOpsStats(30);
  } catch {
    statsError = "بارگذاری آمار سیگنال‌ها ناموفق بود.";
  }

  let trending: Awaited<ReturnType<typeof getTrending>> = [];
  try {
    trending = await getTrending({ limit: 5 });
  } catch {
    trending = [];
  }

  const byType = stats?.interactions_by_type ?? {};
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        title="توصیه‌گر محصولات"
        description="آمار واقعی سیگنال‌های شخصی‌سازی و نمونهٔ trending — بدون دادهٔ ساختگی."
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {statsError ? (
          <DashboardErrorState
            title="آمار در دسترس نیست"
            description={statsError}
          />
        ) : stats ? (
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label={`تعامل‌ها (${faNum(stats.window_days)} روز)`}
              value={faNum(stats.interaction_total)}
            />
            <StatCard
              label="کاربران یکتا"
              value={faNum(stats.unique_users)}
            />
            <StatCard
              label="پروفایل‌های ذخیره‌شده"
              value={faNum(stats.profiles_total)}
            />
          </section>
        ) : null}

        {stats && typeRows.length > 0 ? (
          <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
            <h2 className="font-serif text-lg">تفکیک نوع سیگنال</h2>
            <ul className="mt-3 divide-y divide-border/60">
              {typeRows.map(([type, count]) => (
                <li
                  key={type}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {TYPE_LABELS[type] ?? type}
                  </span>
                  <span className="font-medium tabular-nums">
                    {faNum(count)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              تولید شده در{" "}
              {new Date(stats.generated_at).toLocaleString("fa-IR")}
            </p>
          </section>
        ) : null}

        {stats && typeRows.length === 0 && !statsError ? (
          <p className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            در {faNum(stats.window_days)} روز اخیر تعاملی ثبت نشده است. پس از
            مشاهده/سبد/خرید کاربران واردشده، شمارنده‌ها پر می‌شوند.
          </p>
        ) : null}

        <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <h2 className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="size-5 text-primary" aria-hidden />
            نمونهٔ Trending (زنده)
          </h2>
          {trending.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              trending خالی است (کاتالوگ سرد یا API در دسترس نیست).
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {trending.map((item) => (
                <li
                  key={item.product_id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatPrice(item.min_price)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
          <h2 className="font-serif text-lg">نحوهٔ کار</h2>
          <ul className="mt-3 list-disc space-y-2 pe-5 text-sm leading-6 text-muted-foreground">
            <li>
              سیگنال‌ها از فروشگاه ثبت می‌شوند (view، search_click، recipe_view،
              wishlist، add_to_cart، purchase، …).
            </li>
            <li>
              Job پس‌زمینه پروفایل کاربران فعال را گرم نگه می‌دارد تا{" "}
              <code className="rounded bg-muted px-1 text-xs">for-you</code>{" "}
              سریع باشد.
            </li>
            <li>
              وزن تقریبی: view ۱ · cart ۴ · wishlist ۵ · purchase ۱۰.
            </li>
            <li>
              متریک Prometheus:{" "}
              <code className="rounded bg-muted px-1 text-xs">
                recommendation_interactions_total&#123;interaction_type=…&#125;
              </code>{" "}
              روی <code className="rounded bg-muted px-1 text-xs">/metrics</code>.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/monitoring">مانیتورینگ API</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/analytics">تحلیل‌ها</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-hairline rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/[0.04]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{value}</p>
    </div>
  );
}
