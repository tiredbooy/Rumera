import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

import { RumeraBrandMark } from "@/components/brand/rumera-brand-mark";
import { Button } from "@/components/ui/button";
import { noindexMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = noindexMetadata("آفلاین");

/**
 * Offline fallback — precached by the service worker. Public-only messaging;
 * never promises cart/account data offline.
 */
export default function OfflinePage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="cellar-glow flex min-h-dvh flex-col items-center justify-center px-5 py-14 [padding-bottom:max(3.5rem,env(safe-area-inset-bottom))] [padding-top:max(2rem,env(safe-area-inset-top))]"
    >
      <RumeraBrandMark variant="full" size="lg" href="/" />

      <div className="border-hairline shadow-e3 mt-10 w-full max-w-md rounded-3xl bg-card/90 p-7 text-center ring-1 ring-foreground/5 sm:p-9">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <WifiOff className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 font-serif text-3xl sm:text-4xl">آفلاین هستید</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          اتصال اینترنت برقرار نیست. صفحات عمومی که قبلاً باز کرده‌اید ممکن است
          در دسترس باشند؛ سبد خرید، حساب و پرداخت همیشه به شبکه نیاز دارند.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="h-11 flex-1">
            <Link href="/">تلاش مجدد — خانه</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 flex-1">
            <Link href="/products">فروشگاه</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
