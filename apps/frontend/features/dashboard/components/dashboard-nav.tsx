"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { faNum } from "@/lib/products";
import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  applyNavBadges,
  filterNav,
  groupBadgeTotal,
  groupHasActive,
  isAccordionGroup,
  isActivePath,
  type NavGroup,
  type NavItem,
} from "@/lib/rbac/nav";
import type { Permission } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

export const NAV_COLLAPSE_STORAGE_KEY = "rumera.admin.nav.collapsed";

/**
 * Shared by the desktop sidebar and the mobile sheet.
 * Config lives in `lib/rbac/nav.ts` — this file only renders it.
 */
export function DashboardNav({
  variant,
  permissions,
  badges,
  onNavigate,
}: {
  variant: "admin" | "account";
  permissions: string[];
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
    <nav
      aria-label={variant === "admin" ? "ناوبری پنل مدیریت" : "ناوبری حساب"}
      className="flex flex-col gap-1"
    >
      {groups.map((group, index) =>
        isAccordionGroup(group) ? (
          <NavAccordion
            key={group.id ?? group.title ?? index}
            group={group}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ) : group.items[0] ? (
          <NavLink
            key={group.items[0].href}
            item={group.items[0]}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ) : null,
      )}
    </nav>
  );
}

function NavAccordion({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const storageId = group.id ?? group.title ?? "";
  const hasActive = groupHasActive(group, pathname);
  const [collapsed, toggle] = useCollapsedGroup(
    storageId,
    group.defaultCollapsed === true,
  );
  const open = hasActive || !collapsed;
  const panelId = `nav-panel-${storageId || "group"}`;
  const pending = groupBadgeTotal(group);
  const Icon = group.icon;

  return (
    <div className="rounded-xl">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          pending > 0
            ? `${group.title}، ${faNum(pending)} مورد در انتظار`
            : group.title
        }
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-[0.8125rem] font-medium transition-colors duration-[var(--duration-cellar)] ease-cellar",
          "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
          "[@media(any-pointer:coarse)]:min-h-11",
          hasActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/70",
        )}
      >
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/55",
            )}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">{group.title}</span>
        {pending > 0 ? (
          <span className="min-w-5 shrink-0 rounded-full bg-sidebar-primary/15 px-1.5 py-px text-center text-[0.6875rem] font-medium tabular-nums text-sidebar-primary">
            {faNum(pending)}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-sidebar-foreground/45 transition-transform duration-[var(--duration-cellar)] ease-cellar motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={panelId}
          className="ms-4 mt-0.5 flex flex-col gap-px border-s border-sidebar-border py-0.5 ps-2"
        >
          {group.items.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                nested
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const active = isActivePath(pathname, item.href, item.exact);
  const Icon = item.icon;
  const badge = item.badge != null && item.badge > 0 ? item.badge : undefined;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={
        badge != null ? `${item.label}، ${faNum(badge)} مورد در انتظار` : undefined
      }
      className={cn(
        "group relative flex items-center gap-2 rounded-lg text-[0.8125rem] leading-tight transition-colors duration-[var(--duration-cellar)] ease-cellar",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
        "[@media(any-pointer:coarse)]:min-h-11",
        nested ? "px-2 py-1.5" : "px-2.5 py-2",
        active
          ? "bg-sidebar-primary/12 font-medium text-sidebar-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-sidebar-primary" />
      ) : null}
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          nested ? "size-3.5" : "size-4",
          active
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge != null ? (
        <span className="ms-auto min-w-5 shrink-0 rounded-full bg-sidebar-primary/15 px-1.5 py-px text-center text-[0.6875rem] font-medium tabular-nums text-sidebar-primary">
          {faNum(badge)}
        </span>
      ) : null}
    </Link>
  );
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

function useCollapsedGroup(id: string, defaultCollapsed: boolean) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  React.useEffect(() => {
    if (!id) return;
    const stored = readCollapsedMap()[id];
    if (typeof stored === "boolean") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate collapse from localStorage
      setCollapsed(stored);
    }
  }, [id]);

  const toggle = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      if (!id) return next;
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
  }, [id]);

  return [collapsed, toggle] as const;
}
