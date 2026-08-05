import Link from "next/link";

import { fetchTopProductsByRevenue } from "@/features/analytics/api";
import type { TopProductEntry } from "@/features/analytics/types";
import { getProductForAdmin } from "@/features/admin/products/api/server";
import { faNum, formatPrice } from "@/lib/products";
import { ChartCard, HorizontalBars } from "./Charts";
import { AnalyticsErrorState } from "./AnalyticsErrorState";

async function resolveProductLabel(
  productId: number,
): Promise<{ label: string; href: string }> {
  const href = `/admin/products/${productId}`;
  try {
    const product = await getProductForAdmin(productId);
    return {
      label: product.title || `محصول ${faNum(productId)}`,
      href,
    };
  } catch {
    return {
      label: `محصول ${faNum(productId)}`,
      href,
    };
  }
}

export async function AnalyticsTopProducts({
  from,
  to,
}: {
  from?: string;
  to?: string;
} = {}) {
  let products: TopProductEntry[] = [];
  let failed = false;
  try {
    products = await fetchTopProductsByRevenue({ limit: 8, from, to });
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

  const labels = await Promise.all(
    products.map((p) => resolveProductLabel(p.product_id)),
  );

  const data = products.map((p, index) => ({
    label: labels[index]?.label ?? `محصول ${faNum(p.product_id)}`,
    value: Number(p.total_revenue),
    href: labels[index]?.href,
  }));

  return (
    <ChartCard
      title="پرفروش‌ترین محصولات"
      description="بر اساس درآمد — شناسهٔ کاتالوگ"
      action={
        <Link
          href="/admin/products"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          فهرست محصولات
        </Link>
      }
    >
      <HorizontalBars
        data={data}
        color="oklch(0.55 0.18 25)"
        valueFormatter={(v) => formatPrice(v).replace(" تومان", "")}
      />
    </ChartCard>
  );
}
