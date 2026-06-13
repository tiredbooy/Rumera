import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

/** KPI tile used across the dashboards. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
}: {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  trend?: { value: string; positive?: boolean }
}) {
  return (
    <div className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-serif text-3xl">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend ? (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positive ? "text-emerald-500" : "text-destructive"
            )}
          >
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  )
}
