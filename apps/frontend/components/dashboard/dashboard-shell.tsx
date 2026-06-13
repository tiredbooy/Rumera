"use client"

import * as React from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Wine, Menu, LogOut, Store } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { DashboardNav } from "./dashboard-nav"

export type DashboardUser = {
  name?: string | null
  email?: string | null
  roleLabel: string
}

/**
 * Reusable dashboard chrome for both `/account` and `/admin`: a fixed sidebar on
 * desktop (inline-start → right in RTL) and a sheet drawer on mobile, plus a
 * footer with the signed-in identity, a sign-out action and a link back to the
 * storefront. Pure presentational shell — access control happens in the server
 * layouts that render it.
 */
export function DashboardShell({
  variant,
  permissions,
  user,
  children,
}: {
  variant: "admin" | "account"
  permissions: string[]
  user: DashboardUser
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const title = variant === "admin" ? "پنل مدیریت" : "حساب کاربری"

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Wine className="size-4.5" />
        </span>
        <div className="leading-tight">
          <span className="block font-serif text-xl">
            <span className="text-foil">رومرا</span>
          </span>
          <span className="block text-[11px] text-muted-foreground">{title}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <DashboardNav
          variant={variant}
          permissions={permissions}
          onNavigate={() => setOpen(false)}
        />
      </div>

      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary">
            {(user.name ?? user.email ?? "?").trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
          </div>
        </div>
        <div className="mt-1 flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="justify-start gap-3" asChild>
            <Link href="/">
              <Store className="size-4" /> بازگشت به فروشگاه
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" /> خروج از حساب
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={cn("min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_1fr]")}>
      {/* Desktop sidebar (inline-start) */}
      <aside className="sticky top-0 hidden h-dvh border-e border-border/60 bg-card/40 lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl lg:hidden">
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
          <span className="font-serif text-lg">
            <span className="text-foil">رومرا</span>
          </span>
          <ModeToggle />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  )
}
