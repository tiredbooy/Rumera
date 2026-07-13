"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RANGES, type RangeId } from "@/features/analytics/range";

export function RangeToggle({ current }: { current: RangeId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setRange(id: RangeId) {
    const params = new URLSearchParams(searchParams);
    params.set("range", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={current === r.id}
          onMouseEnter={() => router.prefetch(`${pathname}?range=${r.id}`)}
          onClick={() => setRange(r.id)}
          className={
            "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
            (current === r.id
              ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/[0.06]"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
