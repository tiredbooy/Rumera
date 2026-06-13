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
    <nav className="flex flex-col gap-6">
      {groups.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title ? (
            <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
              {group.title}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
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
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/15 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" />
                    {item.label}
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
