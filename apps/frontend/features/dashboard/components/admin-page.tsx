import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AdminPageWidth } from "./admin-content-width";
import { AdminHelpHint } from "./admin-help-hint";

export type AdminCrumb = { label: string; href?: string };

/** Every admin screen hangs off the console root, so this is the default trail. */
const ADMIN_ROOT: AdminCrumb = { label: "پنل مدیریت", href: "/admin" };

/**
 * The one page shell for the admin console.
 *
 * Compact list chrome (S-6): breadcrumb, a ~20px title with the primary action
 * inline-end, filters in the next row, then content and pagination. Standing
 * copy lives in a help popover so it does not push the first row off-screen.
 */
export function AdminPage({
  breadcrumb,
  title,
  description,
  action,
  filters,
  pagination,
  width = "wide",
  children,
}: {
  /** Ancestor trail. The current page is the title and is appended for you. */
  breadcrumb?: AdminCrumb[];
  title: string;
  description?: string;
  /** Primary action — rendered inline-end of the title, nowhere else. */
  action?: ReactNode;
  /** Usually an `<AdminFilterBar>`. */
  filters?: ReactNode;
  /** Usually a `<ListPagination>`; spacing is applied here, not by the caller. */
  pagination?: ReactNode;
  /**
   * List routes use the full content column. Forms keep the 78rem shell cap
   * by omitting AdminPage or passing `width="default"`.
   */
  width?: "default" | "wide";
  children: ReactNode;
}) {
  return (
    <>
      <AdminPageWidth width={width} />
      <header className="mb-2">
        <AdminBreadcrumb items={breadcrumb ?? [ADMIN_ROOT]} current={title} />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="truncate font-serif text-xl leading-tight tracking-normal">
              {title}
            </h1>
            {description ? (
              <AdminHelpHint>{description}</AdminHelpHint>
            ) : null}
          </div>
          {action ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {action}
            </div>
          ) : null}
        </div>
      </header>
      {filters}
      {children}
      {/* `empty:hidden` keeps the gap from appearing when ListPagination
          renders nothing on a single-page list. */}
      <div className="mt-6 empty:hidden">{pagination}</div>
    </>
  );
}

function AdminBreadcrumb({
  items,
  current,
}: {
  items: AdminCrumb[];
  current: string;
}) {
  return (
    <nav
      aria-label="مسیر صفحه"
      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-x-1.5">
          {item.href ? (
            <Link
              href={item.href}
              className="rounded outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {item.label}
            </Link>
          ) : (
            item.label
          )}
          {/* RTL: “forward” points left. */}
          <ChevronLeft className="size-3 shrink-0 opacity-60" aria-hidden />
        </span>
      ))}
      <span aria-current="page" className="text-foreground/75">
        {current}
      </span>
    </nav>
  );
}

/**
 * Filter controls sit in a single row under the title. No card, no “جستجو و
 * فیلتر …” heading, no icon — the reset hatch stays at the end when anything
 * is applied.
 */
export function AdminFilterBar({
  id,
  title = "جستجو و فیلتر",
  description,
  hasFilters = false,
  resetHref,
  onReset,
  className,
  gridClassName,
  chips,
  children,
}: {
  /** Id for the (visually hidden) heading; the section is labelled by it. */
  id: string;
  title?: string;
  description?: ReactNode;
  hasFilters?: boolean;
  /** Link form of reset (server-rendered lists). */
  resetHref?: string;
  /** Handler form of reset (client-fetched lists). */
  onReset?: () => void;
  className?: string;
  /** Column template for the control grid; spacing stays fixed. */
  gridClassName?: string;
  /**
   * Row under the controls (S-3): `<AdminFilterChips>` for the active filters
   * and `<AdminSavedViews>` for the saved-view action.
   */
  chips?: ReactNode;
  children: ReactNode;
}) {
  const reset = hasFilters ? (
    resetHref ? (
      <Button variant="ghost" size="sm" className="h-9 shrink-0" asChild>
        <Link href={resetHref} aria-label="پاک کردن همهٔ فیلترها">
          <X className="size-4" aria-hidden /> پاک کردن فیلترها
        </Link>
      </Button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 shrink-0"
        onClick={onReset}
        aria-label="پاک کردن همهٔ فیلترها"
      >
        <X className="size-4" aria-hidden /> پاک کردن فیلترها
      </Button>
    )
  ) : null;

  return (
    <section aria-labelledby={id} className={cn("mb-3", className)}>
      <h2 id={id} className="sr-only">
        {title}
      </h2>
      {description ? (
        <div className="sr-only">{description}</div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        {description ? (
          <AdminHelpHint label="راهنمای فیلترها">{description}</AdminHelpHint>
        ) : null}
        <div className={cn("grid min-w-0 flex-1 gap-3", gridClassName)}>
          {children}
        </div>
        {reset}
      </div>
      {/* `empty:hidden` keeps the gap away when nothing is applied. */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 empty:hidden">
        {chips}
      </div>
    </section>
  );
}
