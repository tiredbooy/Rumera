"use client"

import * as React from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Menu, LogOut, Store, ExternalLink } from "lucide-react"

import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import {
  AdminCommandMenu,
  AdminCommandTrigger,
} from "./admin-command-menu"
import {
  AdminContentWidthProvider,
  type AdminContentWidth,
} from "./admin-content-width"
import { DashboardNav } from "./dashboard-nav"

export type DashboardUser = {
  name?: string | null
  email?: string | null
  roleLabel: string
}

/**
 * Reusable dashboard chrome for both `/account` and `/admin`: a fixed sidebar on
 * desktop (inline-start → right in RTL) and a sheet drawer on mobile, plus a
 * sticky top bar and a footer with the signed-in identity, a sign-out action and
 * a link back to the storefront. Pure presentational shell — access control
 * happens in the server layouts that render it.
 */
export function DashboardShell({
  variant,
  permissions,
  user,
  navBadges,
  children,
}: {
  variant: "admin" | "account"
  permissions: string[]
  user: DashboardUser
  navBadges?: Readonly<Record<string, number | null | undefined>>
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [contentWidth, setContentWidth] =
    React.useState<AdminContentWidth>("default")
  const title = variant === "admin" ? "پنل مدیریت" : "حساب کاربری"
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0)

  React.useEffect(() => {
    if (variant !== "admin") return
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [variant])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-5 py-[1.125rem]">
        <RumeraBrandMark
          variant="full"
          size="sm"
          href={variant === "admin" ? "/admin" : "/account"}
          caption={title}
          aria-label={`${title} رومرا`}
        />
      </div>

      <div className="mx-3 h-px bg-border/60" />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <DashboardNav
          variant={variant}
          permissions={permissions}
          badges={navBadges}
          onNavigate={() => setOpen(false)}
        />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-2.5 py-2 ring-1 ring-foreground/[0.04]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary ring-1 ring-primary/15">
            {initial}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
          </div>
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5">
          <Button variant="ghost" size="sm" className="h-9 justify-start gap-3 text-muted-foreground" asChild>
            <Link href="/">
              <Store className="size-4" /> بازگشت به فروشگاه
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" /> خروج از حساب
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={cn("min-h-dvh bg-background lg:grid lg:grid-cols-[15.5rem_1fr]")}>
      {/* Desktop sidebar (inline-start) */}
      <aside className="sticky top-0 hidden h-dvh border-e border-border/60 bg-sidebar/60 backdrop-blur-sm lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="باز کردن منو">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetTitle className="sr-only">{title}</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <span className="min-w-0 truncate font-serif text-lg">
            <span className="text-foil">رومرا</span>
            <span className="ms-2 text-base text-muted-foreground">{title}</span>
          </span>
          <div className="flex items-center gap-0.5">
            {variant === "admin" ? (
              <AdminCommandTrigger
                variant="icon"
                onOpen={() => setCommandOpen(true)}
              />
            ) : null}
            <ModeToggle />
          </div>
        </header>

        {/* Desktop top bar — ⌘K command search + quick actions */}
        <header className="sticky top-0 z-20 hidden h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl lg:flex">
          {variant === "admin" ? (
            <AdminCommandTrigger onOpen={() => setCommandOpen(true)} />
          ) : null}
          <div className="ms-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" asChild>
              <Link href="/" target="_blank">
                <ExternalLink className="size-4" /> فروشگاه
              </Link>
            </Button>
            <ModeToggle />
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 font-serif text-sm text-primary ring-1 ring-primary/15">
              {initial}
            </span>
          </div>
        </header>

        <AdminContentWidthProvider onWidthChange={setContentWidth}>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full flex-1 px-5 py-6 lg:px-8 lg:py-8",
            variant === "admin" && contentWidth === "wide"
              ? "max-w-none"
              : "max-w-[78rem]",
          )}
        >
          {children}
        </main>
        </AdminContentWidthProvider>
        {variant === "admin" ? (
          <AdminCommandMenu
            permissions={permissions}
            open={commandOpen}
            onOpenChange={setCommandOpen}
            trigger="none"
          />
        ) : null}
      </div>
    </div>
  )
}
