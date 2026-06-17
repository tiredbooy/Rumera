import Link from "next/link"
import { ArrowUpLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * AccountStatCard — a warm KPI tile for the account overview. An elevated,
 * hairline-bordered card with a tinted icon medallion, a serif metric and an
 * optional hint. When `href` is supplied the whole tile becomes a link with a
 * subtle affordance, otherwise it renders as a static panel.
 *
 * Replaces the admin-owned dashboard `StatCard` so the account area is fully
 * decoupled from `components/dashboard`.
 */
export function AccountStatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  accent = "gold",
  className,
}: {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  href?: string
  /** Tints the icon medallion to echo the metric's meaning. */
  accent?: "gold" | "wine" | "primary"
  className?: string
}) {
  const medallion =
    accent === "wine"
      ? "bg-wine/10 text-wine ring-wine/15"
      : accent === "primary"
        ? "bg-primary/10 text-primary ring-primary/15"
        : "bg-gold/12 text-gold ring-gold/20"

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover/stat:scale-105",
              medallion
            )}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
      <p className="mt-4 font-serif text-3xl leading-none text-foil">{value}</p>
      <div className="mt-2 flex min-h-4 items-center justify-between gap-2">
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : (
          <span />
        )}
        {href ? (
          <ArrowUpLeft className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/stat:opacity-100" />
        ) : null}
      </div>
    </>
  )

  const base =
    "border-hairline group/stat relative block overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-foreground/5"

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 hover:ring-primary/20",
          className
        )}
      >
        {body}
      </Link>
    )
  }

  return <div className={cn(base, className)}>{body}</div>
}
