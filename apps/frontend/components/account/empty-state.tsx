import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * EmptyState — the shared, account-flavoured empty-view primitive. A calm,
 * editorial panel (icon medallion + serif title + supporting copy) with an
 * optional call-to-action (internal link OR click handler). Used wherever a
 * customer surface has nothing to show yet so the view still feels intentional
 * and points somewhere useful. Pass `children` for bespoke actions.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
  children,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
  children?: React.ReactNode
}) {
  const action = actionLabel ? (
    actionHref ? (
      <Button asChild>
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    ) : (
      <Button onClick={onAction} className="cursor-pointer">
        {actionLabel}
      </Button>
    )
  ) : null

  return (
    <div
      className={cn(
        "border-hairline flex flex-col items-center justify-center rounded-2xl border-dashed bg-card/50 px-6 py-16 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-6" />
        </span>
      ) : null}
      <p className="font-serif text-xl leading-tight">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  )
}
