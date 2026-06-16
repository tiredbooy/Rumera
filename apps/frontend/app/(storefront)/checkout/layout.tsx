/**
 * Checkout is authenticated and per-user: guard with `requireUser`, render
 * dynamically, and keep it out of the index.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck, ChevronRight } from "lucide-react"

import { requireUser } from "@/lib/auth/session"
import { noindexMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = noindexMetadata("تسویه حساب")

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser("/checkout")
  return (
    <div className="flex flex-1 flex-col bg-secondary/30">
      {/* Minimal focused-checkout trust bar */}
      <div className="border-b border-border/60 bg-background/70 backdrop-blur-sm">
        <div className="container-px mx-auto flex max-w-7xl items-center justify-between py-3">
          <Link
            href="/cart"
            className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ChevronRight className="size-4" />
            بازگشت به سبد خرید
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            تسویهٔ امن
          </span>
        </div>
      </div>
      {children}
    </div>
  )
}
