import "server-only";

import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

import { faNum } from "@/lib/products";

/** undefined = not permitted (render nothing), null = the count request failed. */
export type CountState = number | null | undefined;

export type ModuleSummary = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  count?: number | null;
  action?: string;
  /** Draws attention when the count is non-zero — a queue with work waiting. */
  urgent?: boolean;
};

/**
 * Loads one tile's count, degrading rather than failing the page: a caller
 * without the capability gets `undefined` and is skipped, and a failed request
 * gets `null` and renders as an explicit "couldn't fetch" rather than a zero.
 * Showing 0 for a failed fetch would read as "nothing to do" — the exact wrong
 * answer on a work queue.
 */
export async function loadCount(
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

export function ModuleCard({ summary }: { summary: ModuleSummary }) {
  const Icon = summary.icon;
  const unavailable = summary.count === null;
  const value =
    summary.action ?? (unavailable ? "—" : faNum(summary.count ?? 0));
  const waiting = summary.urgent === true && (summary.count ?? 0) > 0;

  return (
    <Link
      href={summary.href}
      data-testid="admin-module-card"
      className={[
        "group border-hairline flex min-h-40 min-w-0 flex-col rounded-2xl bg-card p-5 outline-none ring-1 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-e1 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none",
        waiting ? "ring-primary/25" : "ring-foreground/[0.04]",
      ].join(" ")}
      aria-label={`${summary.label}: ${unavailable ? "آمار در دسترس نیست" : value}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            "flex size-9 shrink-0 items-center justify-center rounded-xl ring-1",
            waiting
              ? "bg-primary/15 text-primary ring-primary/25"
              : "bg-primary/10 text-primary ring-primary/15",
          ].join(" ")}
        >
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
