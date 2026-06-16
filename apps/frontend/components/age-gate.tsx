"use client"

import * as React from "react"
import { Wine } from "lucide-react"

import { Button } from "@/components/ui/button"

const STORAGE_KEY = "rumera:age-verified"

/**
 * Full-screen 21+ verification shown on first visit. The choice is persisted in
 * localStorage so returning visitors are not interrupted. Required dressing for
 * anything selling alcohol — also sets the tone the moment the page loads.
 */
const VERIFIED_EVENT = "rumera:age-verified"

export function AgeGate() {
  // Read the persisted choice from localStorage as an external store. The server
  // snapshot is `true` (gate hidden) so there's no SSR flash; the client then
  // re-reads and shows the gate for unverified visitors. `confirm()` dispatches
  // a custom event so the store re-reads without a manual setState.
  const verified = React.useSyncExternalStore(
    (notify) => {
      window.addEventListener(VERIFIED_EVENT, notify)
      window.addEventListener("storage", notify)
      return () => {
        window.removeEventListener(VERIFIED_EVENT, notify)
        window.removeEventListener("storage", notify)
      }
    },
    () => window.localStorage.getItem(STORAGE_KEY) === "true",
    () => true
  )

  // Lock body scroll while the gate is open.
  React.useEffect(() => {
    if (!verified) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [verified])

  if (verified) return null

  function confirm() {
    window.localStorage.setItem(STORAGE_KEY, "true")
    window.dispatchEvent(new Event(VERIFIED_EVENT))
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/85 backdrop-blur-md">
      <div className="cellar-glow border-hairline relative mx-5 w-full max-w-md overflow-hidden rounded-3xl bg-card p-8 text-center shadow-2xl ring-1 ring-foreground/10 sm:p-10">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Wine className="size-6" />
        </div>
        <p className="eyebrow justify-center">لطفاً تأیید کنید</p>
        <h2 className="mt-3 font-serif text-4xl">به سنِ قانونی نوشیدن رسیده‌اید؟</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          برای ورود به رومرا باید ۱۸ سال یا بیشتر داشته باشید. لطفاً مسئولانه
          بنوشید.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-11 flex-1 text-sm" onClick={confirm}>
            بله، ۱۸ سال یا بیشتر دارم
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 flex-1 text-sm"
            onClick={() => {
              window.location.href = "https://www.google.com"
            }}
          >
            خیر، مرا بازگردان
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/80">
          با ورود، شرایط استفاده و سیاست حریم خصوصی ما را می‌پذیرید.
        </p>
      </div>
    </div>
  )
}
