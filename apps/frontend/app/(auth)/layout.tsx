/**
 * Auth shell — a calm, centred, minimal-chrome layout for sign-in / sign-up /
 * password flows. Marked `noindex` (these pages should never rank), with just
 * the brand mark and a way back to the storefront.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Wine } from "lucide-react"

import { noindexMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = noindexMetadata("حساب کاربری")

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cellar-glow flex min-h-dvh flex-col items-center justify-center px-5 py-14">
      <Link
        href="/"
        aria-label="رومرا — صفحهٔ اصلی"
        className="mb-9 flex items-center gap-2.5 rounded-2xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Wine className="size-5" />
        </span>
        <span className="font-serif text-3xl leading-none">
          <span className="text-foil">رومرا</span>
        </span>
      </Link>

      <main
        id="main-content"
        tabIndex={-1}
        className="border-hairline shadow-e3 relative w-full max-w-md overflow-hidden rounded-3xl bg-card/80 p-7 ring-1 ring-foreground/5 backdrop-blur-xl sm:p-9"
      >
        <div aria-hidden className="rule-gold absolute inset-x-8 top-0" />
        {children}
      </main>

      <Link
        href="/"
        className="group mt-7 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <ArrowRight className="size-4 transition-transform group-hover:-translate-x-0.5" />
        بازگشت به فروشگاه
      </Link>
    </div>
  )
}
