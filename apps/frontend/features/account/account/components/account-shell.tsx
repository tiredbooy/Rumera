"use client"

import * as React from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Wine, Menu, LogOut, Store } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"
import { AccountNav } from "./account-nav"

export type AccountUser = {
  name?: string | null
  email?: string | null
  roleLabel: string
}

/**
 * AccountShell — the dedicated chrome for the logged-in customer area. A fixed
 * sidebar on desktop (inline-start, i.e. right in RTL) and a sheet drawer on
 * mobile, framed by a warm cellar-glow brand header and an identity card with a
 * gold monogram, plus quick links back to the storefront and a sign-out action.
 *
 * Purely presentational — access control is enforced in the server layout that
 * renders it. Owned by the account lane; independent of the admin dashboard
 * shell.
 */
export function AccountShell({
  user,
  children,
}: {
  user: AccountUser
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0)

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="cellar-glow border-b border-border/60 px-5 py-5">
        <Link href="/account" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <Wine className="size-5" />
          </span>
          <div className="leading-tight">
            <span className="block font-serif text-xl text-foil">رومرا</span>
            <span className="block text-[11px] text-muted-foreground">حساب کاربری</span>
          </div>
        </Link>
      </div>

      {/* Identity card */}
      <div className="px-3 pt-4">
        <div className="border-hairline flex items-center gap-3 rounded-2xl bg-card/60 px-3 py-3 ring-1 ring-foreground/5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 font-serif text-lg text-gold ring-1 ring-gold/25">
            {initial}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AccountNav onNavigate={() => setOpen(false)} />
      </div>

      {/* Footer actions */}
      <div className="border-t border-border/60 p-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" className="justify-start gap-3" asChild>
            <Link href="/">
              <Store className="size-4" /> بازگشت به فروشگاه
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" /> خروج از حساب
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar (inline-start → right in RTL) */}
      <aside className="sticky top-0 hidden h-dvh border-e border-border/60 bg-card/40 lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex min-h-dvh flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="باز کردن منو" className="cursor-pointer">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetTitle className="sr-only">حساب کاربری</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <Link href="/account" className="flex items-center gap-2">
            <span className="font-serif text-lg text-foil">رومرا</span>
          </Link>
          <ModeToggle />
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-5 py-7 lg:px-10 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
