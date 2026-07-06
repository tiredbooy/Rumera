import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

/**
 * Empty/placeholder panel for dashboard sections whose live data binding is a
 * follow-up. Keeps the scaffold honest — it visibly says "not wired yet" rather
 * than faking data.
 */
export function Placeholder({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "border-hairline flex flex-col items-center justify-center rounded-2xl border-dashed bg-card/40 px-6 py-14 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}
