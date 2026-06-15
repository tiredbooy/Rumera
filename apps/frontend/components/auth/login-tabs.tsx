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

  return (
    <div>
      <div
        role="tablist"
        aria-label="روش ورود"
        className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-secondary/60 p-1"
      >
        {tabs.map((t) => {
          const active = method === t.value
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setMethod(t.value)}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {method === "phone" ? (
        <PhoneLoginForm callbackUrl={callbackUrl} />
      ) : (
        <LoginForm callbackUrl={callbackUrl} />
      )}
    </div>
  )
}
