"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { ACCOUNT_NAV } from "@/lib/rbac/nav"

/**
 * AccountNav — the customer account link list, shared by the desktop sidebar and
 * the mobile drawer. Reads the canonical `ACCOUNT_NAV` config (icons can't cross
 * the server→client boundary as props) and highlights the active route with a
 * tinted pill plus an inline-start accent bar.
 *
 * Owned entirely by the account lane — independent of the admin dashboard nav.
 */
export function AccountNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-6" aria-label="منوی حساب کاربری">
      {ACCOUNT_NAV.map((group, i) => (
        <div key={group.title ?? i}>
          {group.title ? (
            <p className="mb-2 px-3 text-[11px] font-medium tracking-wide text-muted-foreground">
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
                      "group/nav relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200",
                      active
                        ? "bg-primary/12 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 start-0 w-1 rounded-full bg-primary"
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-4.5 shrink-0 transition-transform duration-200",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover/nav:text-foreground"
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
