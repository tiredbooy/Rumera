import { CheckCircle2, Ban } from "lucide-react"

import { cn } from "@/lib/utils"
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles"

/**
 * Shared active/inactive and role pills for admin user and product tables.
 */

type Tone = "emerald" | "muted"

const TONE: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground ring-border/60",
}

/**
 * Active/inactive badge for a backend user account. Carries an icon AND a label
 * (not colour alone) so the state is legible to colour-blind users and screen
 * readers — `is_active` from `GET /admin/users`.
 */
export function UserStatusBadge({ active }: { active: boolean }) {
  const tone: Tone = active ? "emerald" : "muted"
  const Icon = active ? CheckCircle2 : Ban
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone]
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {active ? "فعال" : "غیرفعال"}
    </span>
  )
}

/** Persian role pill (`ROLE_LABELS`) for the admin users list/detail. */
export function UserRoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
      {ROLE_LABELS[role]}
    </span>
  )
}
