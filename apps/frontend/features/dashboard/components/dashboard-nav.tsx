"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { faNum } from "@/lib/products";
import {
  ADMIN_NAV,
  ACCOUNT_NAV,
  applyNavBadges,
  filterNav,
  type NavGroup,
} from "@/lib/rbac/nav";
import type { Permission } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

export const NAV_COLLAPSE_STORAGE_KEY = "rumera.admin.nav.collapsed";

/**
 * The actual link list, shared by the desktop sidebar and the mobile sheet.
 * It imports the nav config directly (icons can't cross the server→client
 * boundary as props) and filters it by the frontend capabilities handed down
 * from the server layout. Only the admin role receives those capabilities.
 *
 * Active rows get an inline-start accent bar + tinted surface (Linear-style),
 * giving the dense console a clear "you are here" without shouting.
 */
export function DashboardNav({
  variant,
  permissions,
  badges,
  onNavigate,
}: {
  variant: "admin" | "account";
  permissions: string[];
  /** Pending-work counts keyed by href, same totals as the S-1 work queue. */
  badges?: Readonly<Record<string, number | null | undefined>>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = applyNavBadges(
    filterNav(variant === "admin" ? ADMIN_NAV : ACCOUNT_NAV, {
      permissions: permissions as Permission[],
    }),
    badges ?? {},
  );

  return (
    <nav className="flex flex-col gap-2">
      {groups.map((group, i) => (
        <NavGroupBlock
          key={group.id ?? group.title ?? i}
          group={group}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function NavGroupBlock({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const storageId = group.id ?? group.title ?? "";
  const [collapsed, toggle] = useCollapsedGroup(
    storageId,
    group.collapsible === true,
    group.defaultCollapsed === true,
  );
  const hasActive = group.items.some((item) => isActivePath(pathname, item.href, item.exact));
  const hidden = group.collapsible === true && collapsed && !hasActive;

  return (
    <div>
      {group.title ? (
        group.collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!hidden}
            className="mb-1 flex w-full items-center gap-1 rounded-md px-3 py-1 text-start text-[0.6875rem] font-semibold tracking-normal text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <span className="min-w-0 flex-1 truncate">{group.title}</span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 transition-transform",
                hidden && "-rotate-90",
              )}
              aria-hidden
            />
          </button>
        ) : (
          <p className="mb-1 px-3 text-[0.6875rem] font-semibold tracking-normal text-muted-foreground/70">
            {group.title}
          </p>
        )
      ) : null}
      {hidden ? null : (
        <ul className="flex flex-col gap-px">
          {group.items.map((item) => {
            const active = isActivePath(pathname, item.href, item.exact);
            const Icon = item.icon;
            const badge =
              item.badge != null && item.badge > 0 ? item.badge : undefined;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    badge != null
                      ? `${item.label}، ${faNum(badge)} مورد در انتظار`
                      : undefined
                  }
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[0.8125rem] leading-tight transition-colors duration-150 lg:py-1",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-primary" />
                  ) : null}
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {badge != null ? (
                    <span className="ms-auto min-w-5 shrink-0 rounded-full bg-primary/15 px-1.5 py-px text-center text-[0.6875rem] font-medium tabular-nums text-primary">
                      {faNum(badge)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function readCollapsedMap(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function useCollapsedGroup(
  id: string,
  enabled: boolean,
  defaultCollapsed: boolean,
) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  React.useEffect(() => {
    if (!enabled || !id) return;
    const stored = readCollapsedMap()[id];
    if (typeof stored === "boolean") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate collapse from localStorage
      setCollapsed(stored);
    }
  }, [enabled, id]);

  const toggle = React.useCallback(() => {
    if (!enabled) return;
    setCollapsed((current) => {
      const next = !current;
      try {
        const map = readCollapsedMap();
        map[id] = next;
        window.localStorage.setItem(
          NAV_COLLAPSE_STORAGE_KEY,
          JSON.stringify(map),
        );
      } catch {
        // private mode — keep the in-memory toggle
      }
      return next;
    });
  }, [enabled, id]);

  return [collapsed, toggle] as const;
}
