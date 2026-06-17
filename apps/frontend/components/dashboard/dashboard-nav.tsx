"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { ADMIN_NAV, ACCOUNT_NAV, filterNav } from "@/lib/rbac/nav"
import type { Permission } from "@/lib/rbac/permissions"

/**
 * The actual link list, shared by the desktop sidebar and the mobile sheet.
 * It imports the nav config directly (icons can't cross the server→client
 * boundary as props) and filters it by the `permissions` handed down from the
 * server layout — so each staff role sees only its permitted sections.
 *
 * Active rows get an inline-start accent bar + tinted surface (Linear-style),
 * giving the dense console a clear "you are here" without shouting.
 */
export function DashboardNav({
  variant,
  permissions,
  onNavigate,
}: {
  variant: "admin" | "account"
  permissions: string[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const groups = filterNav(variant === "admin" ? ADMIN_NAV : ACCOUNT_NAV, {
    permissions: permissions as Permission[],
  })

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title ? (
            <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-normal text-muted-foreground/70">
              {group.title}
            </p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      active
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary" />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-4.5 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
