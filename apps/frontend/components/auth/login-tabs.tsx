"use client"

import * as React from "react"
import { Mail, Smartphone } from "lucide-react"

import { cn } from "@/lib/utils"
import { LoginForm } from "@/components/auth/login-form"
import { PhoneLoginForm } from "@/components/auth/phone-login-form"

type Method = "email" | "phone"

const tabs: { value: Method; label: string; icon: typeof Mail }[] = [
  { value: "phone", label: "شماره موبایل", icon: Smartphone },
  { value: "email", label: "ایمیل", icon: Mail },
]

/**
 * LoginTabs — segmented switch between phone (OTP) and email/password login.
 * Phone is first since it's the primary flow for the Iranian market.
 */
export function LoginTabs({ callbackUrl }: { callbackUrl: string }) {
  const [method, setMethod] = React.useState<Method>("phone")
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  // Roving focus: arrow keys move between tabs (RTL-aware), Home/End jump to ends.
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index
    if (e.key === "ArrowRight") next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === "ArrowLeft") next = (index + 1) % tabs.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = tabs.length - 1
    else return
    e.preventDefault()
    setMethod(tabs[next].value)
    tabRefs.current[next]?.focus()
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="روش ورود"
        aria-orientation="horizontal"
        className="mb-7 grid grid-cols-2 gap-1 rounded-2xl border-hairline bg-secondary/60 p-1"
      >
        {tabs.map((t, i) => {
          const active = method === t.value
          return (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={`login-tab-${t.value}`}
              aria-selected={active}
              aria-controls={`login-panel-${t.value}`}
              tabIndex={active ? 0 : -1}
              type="button"
              onClick={() => setMethod(t.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/5"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`login-panel-${method}`}
        aria-labelledby={`login-tab-${method}`}
      >
        {method === "phone" ? (
          <PhoneLoginForm callbackUrl={callbackUrl} />
        ) : (
          <LoginForm callbackUrl={callbackUrl} />
        )}
      </div>
    </div>
  )
}
