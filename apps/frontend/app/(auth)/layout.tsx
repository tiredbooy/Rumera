/**
 * Auth shell — a calm, centred, minimal-chrome layout for sign-in / sign-up /
 * password flows. Marked `noindex` (these pages should never rank), with just
 * the brand mark and a way back to the storefront.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { Wine } from "lucide-react"

import { noindexMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = noindexMetadata("حساب کاربری")

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cellar-glow flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Wine className="size-5" />
        </span>
        <span className="font-serif text-3xl leading-none">
          <span className="text-foil">رومرا</span>
        </span>
      </Link>

      <div className="border-hairline w-full max-w-md rounded-3xl bg-card/80 p-7 shadow-xl ring-1 ring-foreground/5 backdrop-blur-sm sm:p-9">
        {children}
      </div>

      <Link
        href="/"
        className="mt-6 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ← بازگشت به فروشگاه
      </Link>
    </div>
  )
}
