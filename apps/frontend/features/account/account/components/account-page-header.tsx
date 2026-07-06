import { cn } from "@/lib/utils"

/**
 * AccountPageHeader — the consistent title block atop every account page.
 * A serif display title with an optional eyebrow, supporting description and an
 * inline-end actions slot. Replaces the old shared dashboard `PageHeader` so the
 * customer area no longer depends on the admin-owned `components/dashboard`.
 */
export function AccountPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-8",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
