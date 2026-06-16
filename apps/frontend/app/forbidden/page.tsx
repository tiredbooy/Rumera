/**
 * Standalone 403 page. Lives OUTSIDE the guarded /admin layout (otherwise the
 * guard would redirect here in a loop). Shown when a signed-in but
 * insufficiently-privileged user hits an admin route.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlert, Wine, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { noindexMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = noindexMetadata("دسترسی غیرمجاز")

export default function ForbiddenPage() {
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

      <div className="border-hairline w-full max-w-md rounded-3xl bg-card/80 p-8 text-center shadow-xl ring-1 ring-foreground/5 backdrop-blur-sm sm:p-10">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-8" />
        </span>

        <p className="eyebrow mt-6 justify-center text-destructive">خطای ۴۰۳</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">
          دسترسی غیرمجاز
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
          شما اجازهٔ دسترسی به این بخش را ندارید. اگر فکر می‌کنید اشتباهی رخ
          داده، با حساب دیگری وارد شوید یا با مدیر سیستم تماس بگیرید.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button className="h-11 px-6 text-sm" asChild>
            <Link href="/login">ورود با حساب دیگر</Link>
          </Button>
          <Button variant="outline" className="h-11 px-6 text-sm" asChild>
            <Link href="/account">حساب کاربری</Link>
          </Button>
        </div>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        بازگشت به فروشگاه
      </Link>
    </div>
  )
}
