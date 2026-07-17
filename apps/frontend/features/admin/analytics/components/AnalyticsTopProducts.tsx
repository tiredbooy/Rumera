import { fetchTopProductsByRevenue } from "@/features/analytics/api";
import type { TopProductEntry } from "@/features/analytics/types";
import { formatPrice } from "@/lib/products";
import { ChartCard, HorizontalBars } from "./Charts";
import { AnalyticsErrorState } from "./AnalyticsErrorState";

export async function AnalyticsTopProducts() {
  let products: TopProductEntry[] = [];
  let failed = false;
  try {
    products = await fetchTopProductsByRevenue({ limit: 8 });
  } catch {
    failed = true;
  }

  if (failed || products.length === 0) {
    return (
      <ChartCard title="پرفروش‌ترین محصولات" description="بر اساس درآمد">
        {failed ? (
          <AnalyticsErrorState className="h-40">
            خطا در دریافت محصولات پرفروش
          </AnalyticsErrorState>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            داده‌ای برای این بازه ثبت نشده است.
          </div>
        )}
      </ChartCard>
    );
  }

  const data = products.map((p) => ({
    label: p.product_id,
    value: Number(p.total_revenue),
  }));

  return (
    <ChartCard title="پرفروش‌ترین محصولات" description="بر اساس درآمد">
      <HorizontalBars
        data={data}
        color="oklch(0.55 0.18 25)"
        valueFormatter={(v) => formatPrice(v).replace(" تومان", "")}
      />
    </ChartCard>
  );
}
