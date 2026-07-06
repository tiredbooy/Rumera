import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

/** Tiny inline sparkline (pure SVG, no JS chart lib) for KPI tiles. */
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null
  const w = 96
  const h = 32
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => [i * step, h - ((v - min) / span) * (h - 4) - 2])
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${line} L${w},${h} L0,${h} Z`
  const stroke = positive ? "var(--gold)" : "var(--destructive)"
  const id = `spark-${positive ? "p" : "n"}`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="overflow-visible"
      aria-hidden
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** KPI tile used across the dashboards. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  spark,
}: {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  trend?: { value: string; positive?: boolean }
  /** Optional sparkline series rendered along the bottom. */
  spark?: number[]
}) {
  const positive = trend?.positive ?? true

  return (
    <div className="group border-hairline relative overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors duration-200 hover:ring-primary/20">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      <p className="mt-3 font-serif text-[1.75rem] leading-none tabular-nums">{value}</p>

      <div className="mt-2.5 flex items-center gap-2">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
              positive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {trend.value}
          </span>
        ) : null}
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </div>

      {spark ? (
        <div className="pointer-events-none mt-3 -mb-1 ms-auto w-24 opacity-70 transition-opacity group-hover:opacity-100">
          <Sparkline data={spark} positive={positive} />
        </div>
      ) : null}
    </div>
  )
}
