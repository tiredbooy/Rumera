"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Donut palette — one accent per slice, warm→cool. Keep in lock-step with `@/lib/charts` `SLICE_COLORS`. */
export const SLICE_COLORS = [
  "oklch(0.72 0.15 75)",
  "oklch(0.55 0.18 25)",
  "oklch(0.62 0.16 250)",
  "oklch(0.68 0.14 160)",
  "oklch(0.6 0.16 320)",
  "oklch(0.7 0.13 130)",
  "oklch(0.58 0.05 250)",
]

/** Framed chart panel matching the dashboard card system. */
export function ChartCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04]",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-base leading-tight sm:text-lg">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}

export { HorizontalBars } from "./dynamic-charts"
