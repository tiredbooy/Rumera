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
export function AgeGate() {
  const [verified, setVerified] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    setVerified(window.localStorage.getItem(STORAGE_KEY) === "true")
  }, [])

  // Lock body scroll while the gate is open.
  React.useEffect(() => {
    if (verified === false) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [verified])

  if (verified !== false) return null

  function confirm() {
    window.localStorage.setItem(STORAGE_KEY, "true")
    setVerified(true)
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/85 backdrop-blur-md">
      <div className="cellar-glow border-hairline relative mx-5 w-full max-w-md overflow-hidden rounded-3xl bg-card p-8 text-center shadow-2xl ring-1 ring-foreground/10 sm:p-10">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Wine className="size-6" />
        </div>
        <p className="eyebrow justify-center">Please verify</p>
        <h2 className="mt-3 font-serif text-3xl">Are you of legal drinking age?</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          You must be 21 or older to enter Rumera. Please drink responsibly.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-11 flex-1 text-sm" onClick={confirm}>
            Yes, I&apos;m 21 or older
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 flex-1 text-sm"
            onClick={() => {
              window.location.href = "https://www.google.com"
            }}
          >
            No, take me back
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground/80">
          By entering you accept our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
