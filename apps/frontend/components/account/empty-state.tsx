import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Placeholder } from "@/components/dashboard/placeholder"

/**
 * EmptyState — a thin, account-flavoured wrapper over the shared `Placeholder`
 * that bakes in an optional call-to-action (internal link or click handler). Use
 * it wherever a customer surface has nothing to show yet so the empty view still
 * feels intentional and points somewhere useful.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
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
    <Placeholder icon={icon} title={title} description={description} className={className}>
      {action}
    </Placeholder>
  )
}
