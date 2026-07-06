import { cn } from "@/lib/utils"

/**
 * AccountSection — the canonical titled card used across the account dashboard.
 * A hairline-bordered container (§5 recipe) with an optional header row (title +
 * description on the inline-start, an action slot on the inline-end) and a body.
 * Keeps every account page visually consistent without re-declaring the chrome.
 */
export function AccountSection({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5",
        className
      )}
    >
      {title || action ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {title ? <h2 className="font-serif text-xl leading-tight">{title}</h2> : null}
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  )
}
