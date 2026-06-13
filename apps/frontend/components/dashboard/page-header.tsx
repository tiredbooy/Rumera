import { cn } from "@/lib/utils"

/** Consistent page title + optional description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
