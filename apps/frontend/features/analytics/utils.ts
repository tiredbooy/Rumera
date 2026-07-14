import { faNum } from "@/lib/products";

export function analyticsNumber(
  value: string | number | null | undefined,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function analyticsTrend(
  current: number,
  previous: number,
): { value: string; positive: boolean } | undefined {
  if (previous <= 0) return undefined;
  const percentage = Math.round(((current - previous) / previous) * 100);
  const positive = percentage >= 0;
  return {
    value: `${positive ? "+" : "−"}${faNum(Math.abs(percentage))}٪`,
    positive,
  };
}

export function shortAnalyticsDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(5, 10);
  }
}
