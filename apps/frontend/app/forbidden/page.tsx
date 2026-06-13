/**
 * Standalone 403 page. Lives OUTSIDE the guarded /admin layout (otherwise the
 * guard would redirect here in a loop). Shown when a signed-in but
 * insufficiently-privileged user hits an admin route.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { noindexMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = noindexMetadata("دسترسی غیرمجاز")

export default function ForbiddenPage() {
  return (
    <div className="cellar-glow flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <span className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="size-8" />
      </span>
      <h1 className="font-serif text-4xl">دسترسی غیرمجاز</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        شما اجازهٔ دسترسی به این بخش را ندارید. اگر فکر می‌کنید اشتباهی رخ داده،
        با مدیر سیستم تماس بگیرید.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/account">حساب کاربری</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">بازگشت به فروشگاه</Link>
        </Button>
      </div>
    </div>
  )
}
