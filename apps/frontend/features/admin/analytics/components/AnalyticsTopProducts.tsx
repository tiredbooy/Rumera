import { fetchTopProductsByRevenue } from "../api";
import { formatPrice } from "@/lib/products";
import { ChartCard, HorizontalBars } from "./Charts";
export async function AnalyticsTopProducts() {
  const products = await fetchTopProductsByRevenue(8).catch(() => null);

  if (!products || products.length === 0) {
    return (
      <ChartCard title="پرفروش‌ترین محصولات" description="بر اساس درآمد">
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          داده‌ای موجود نیست.
        </div>
      </ChartCard>
    );
  }

  const data = products.map((p) => ({
    label: p.product_id,
    value: Number(p.revenue),
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
