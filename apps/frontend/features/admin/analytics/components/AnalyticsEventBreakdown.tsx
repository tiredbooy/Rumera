import { fetchEventBreakdown } from "@/features/analytics/api";
import type { EventBreakdown } from "@/features/analytics/types";
import { CHART_BLUE } from "@/lib/charts/theme";
import { faNum } from "@/lib/products";
import { ChartCard } from "./Charts";
import { HorizontalBars } from "./dynamic-charts";
import { AnalyticsErrorState } from "./AnalyticsErrorState";

const EVENT_LABELS: Record<string, string> = {
  product_viewed: "بازدید محصول",
  recipe_viewed: "بازدید دستور",
  blog_viewed: "بازدید مجله",
  search_performed: "جستجو",
  cart_updated: "به‌روزرسانی سبد",
  order_created: "ایجاد سفارش",
  page_viewed: "بازدید صفحه",
};

function labelFor(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

export async function AnalyticsEventBreakdown({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  let breakdown: EventBreakdown = {};
  let failed = false;
  try {
    breakdown = await fetchEventBreakdown({ from, to });
  } catch {
    failed = true;
  }

  const entries = Object.entries(breakdown)
    .map(([eventType, count]) => ({
      label: labelFor(eventType),
      value: Number(count) || 0,
    }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <ChartCard
      title="رویدادها"
      description="توزیع انواع رویداد در بازهٔ انتخابی"
    >
      {failed ? (
        <AnalyticsErrorState className="h-40">
          خطا در دریافت رویدادها
        </AnalyticsErrorState>
      ) : entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          رویدادی در این بازه ثبت نشده است.
        </div>
      ) : (
        <HorizontalBars
          data={entries}
          color={CHART_BLUE}
          valueFormatter={(v) => faNum(v)}
          ariaLabel="توزیع انواع رویداد"
        />
      )}
    </ChartCard>
  );
}
