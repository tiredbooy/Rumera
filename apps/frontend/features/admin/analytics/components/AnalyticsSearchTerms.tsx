import {
  fetchTopConvertingSearchTerms,
  fetchTopSearchTerms,
  fetchZeroResultSearchTerms,
} from "@/features/analytics/api";
import type { SearchTermSummary } from "@/features/analytics/types";
import { analyticsNumber } from "@/features/analytics/utils";
import { faNum } from "@/lib/products";
import { ChartCard } from "./Charts";
import { AnalyticsErrorState } from "./AnalyticsErrorState";

function TermTable({
  terms,
  metric,
  metricLabel,
}: {
  terms: SearchTermSummary[];
  metric: (term: SearchTermSummary) => string;
  metricLabel: string;
}) {
  if (terms.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
        داده‌ای برای این بازه ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[16rem] text-sm">
        <thead>
          <tr className="border-b border-border/50 text-start text-xs text-muted-foreground">
            <th className="py-2 pe-3 font-medium">عبارت</th>
            <th className="py-2 text-end font-medium">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {terms.map((term) => (
            <tr
              key={term.query_text}
              className="border-b border-border/30 last:border-0"
            >
              <td className="max-w-[12rem] truncate py-2.5 pe-3 font-medium">
                {term.query_text || "—"}
              </td>
              <td className="py-2.5 text-end tabular-nums text-muted-foreground">
                {metric(term)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function AnalyticsSearchTerms({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  const range = { from, to, limit: 8 };
  let top: SearchTermSummary[] = [];
  let zero: SearchTermSummary[] = [];
  let converting: SearchTermSummary[] = [];
  let failed = false;

  try {
    ;[top, zero, converting] = await Promise.all([
      fetchTopSearchTerms(range),
      fetchZeroResultSearchTerms(range),
      fetchTopConvertingSearchTerms(range),
    ]);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <ChartCard title="جستجو" description="عبارات پرتکرار و بدون نتیجه">
        <AnalyticsErrorState className="h-40">
          خطا در دریافت آمار جستجو
        </AnalyticsErrorState>
      </ChartCard>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="پرجستجوترین‌ها" description="بر اساس تعداد جستجو">
        <TermTable
          terms={top}
          metricLabel="جستجو"
          metric={(t) => faNum(t.total_searches)}
        />
      </ChartCard>
      <ChartCard title="بدون نتیجه" description="فرصت بهبود کاتالوگ">
        <TermTable
          terms={zero}
          metricLabel="دفعات"
          metric={(t) => faNum(t.zero_results || t.total_searches)}
        />
      </ChartCard>
      <ChartCard title="پرتبدیل‌ترین‌ها" description="نرخ تبدیل به خرید">
        <TermTable
          terms={converting}
          metricLabel="تبدیل"
          metric={(t) =>
            `${faNum(Math.round(analyticsNumber(t.avg_conversion) * 100))}٪`
          }
        />
      </ChartCard>
    </div>
  );
}
