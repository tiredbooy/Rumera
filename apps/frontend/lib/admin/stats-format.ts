/**
 * Shared formatting/derivation helpers for the admin analytics + dashboard
 * boards. The backend serialises money/rate fields with shopspring/decimal,
 * i.e. as JSON *strings* — `num()` is the single place that coerces them.
 */
import { faNum } from "@/lib/products"

/** Parse a shopspring/decimal JSON string (or number) into a finite number. */
export function num(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0)
}

/** Period-over-period delta as a signed Persian percentage, or undefined if N/A. */
export function trendOf(curr: number, prev: number): { value: string; positive: boolean } | undefined {
  if (!prev || prev <= 0) return undefined
  const pct = Math.round(((curr - prev) / prev) * 100)
  const positive = pct >= 0
  return { value: `${positive ? "+" : "−"}${faNum(Math.abs(pct))}٪`, positive }
}

/** Short Persian day label for a chart x-axis, from an RFC3339 date. */
export function shortDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" }).format(new Date(iso))
  } catch {
    return iso.slice(5, 10)
  }
}
