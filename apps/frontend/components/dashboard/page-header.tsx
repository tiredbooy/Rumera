import { cn } from "@/lib/utils"

/**
 * Consistent page heading for the admin console: an optional eyebrow/breadcrumb
 * slot, the title, an optional description, and right-aligned actions. Tuned for
 * a dense back-office (smaller serif than the editorial storefront) so screens
 * read like a tool, not a marketing page.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  /** Breadcrumb / context row rendered above the title. */
  eyebrow?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
        <h1 className="font-serif text-2xl leading-tight tracking-normal sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
