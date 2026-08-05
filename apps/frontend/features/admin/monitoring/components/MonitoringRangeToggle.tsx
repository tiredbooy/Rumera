import Link from "next/link";

import type { MonitoringRange } from "@/features/admin/monitoring/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: MonitoringRange; label: string }[] = [
  { value: "1h", label: "۱ ساعت" },
  { value: "6h", label: "۶ ساعت" },
  { value: "24h", label: "۲۴ ساعت" },
  { value: "7d", label: "۷ روز" },
];

export function MonitoringRangeToggle({
  active,
}: {
  active: MonitoringRange;
}) {
  return (
    <div
      role="group"
      aria-label="بازهٔ زمانی"
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1"
    >
      {OPTIONS.map((option) => {
        const selected = option.value === active;
        return (
          <Link
            key={option.value}
            href={
              option.value === "1h"
                ? "/admin/monitoring"
                : `/admin/monitoring?range=${option.value}`
            }
            className={cn(
              "inline-flex min-h-10 min-w-16 items-center justify-center rounded-xl px-3 text-xs font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary/40",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={selected ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
