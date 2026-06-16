"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { AlertCircle, Loader2, Smartphone, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { faNum } from "@/lib/products"

const RESEND_SECONDS = 60

/**
 * PhoneLoginForm — SMS OTP login in two steps: enter phone → enter the 6-digit
 * code. Requesting the code goes through the same-origin `/api/public` proxy;
 * verifying it uses next-auth's "otp" credentials provider (server-side).
 */
export function PhoneLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [step, setStep] = React.useState<"phone" | "code">("phone")
  const [phone, setPhone] = React.useState("")
  const [code, setCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [cooldown, setCooldown] = React.useState(0)

  React.useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/public/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      if (!res.ok) {
        setError(
          res.status === 429
            ? "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید."
            : "شماره موبایل نامعتبر است."
        )
        return
      }
      setStep("code")
      setCode("")
      setCooldown(RESEND_SECONDS)
    } catch {
      setError("ارتباط با سرور برقرار نشد.")
    } finally {
      setLoading(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await signIn("otp", { phone: phone.trim(), code: code.trim(), redirect: false })
    if (!res || res.error) {
      setError("کد واردشده نادرست یا منقضی شده است.")
      setLoading(false)
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  const header = (
    <div className="mb-6">
      <span className="eyebrow">ورود با پیامک</span>
      <h1 className="mt-2 font-serif text-3xl">
        {step === "phone" ? "ورود با شمارهٔ موبایل" : "تأیید شماره"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {step === "phone"
          ? "شماره موبایل خود را وارد کنید؛ اگر حساب نداشته باشید ساخته می‌شود."
          : "کد ۶ رقمی پیامک‌شده را وارد کنید."}
      </p>
    </div>
  )

  if (step === "phone") {
    return (
      <div>
        {header}
      <form onSubmit={requestCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">شمارهٔ موبایل</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            required
            placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={!!error}
            className="h-11 text-start"
          />
          <p className="text-xs text-muted-foreground">
            کد تأیید به این شماره پیامک می‌شود.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-1 h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Smartphone />}
          ارسال کد تأیید
        </Button>
      </form>
      </div>
    )
  }

  return (
    <div>
      {header}
    <form onSubmit={verify} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border-hairline bg-secondary/60 px-3 py-2.5 text-sm">
        <span dir="ltr" className="font-medium">{phone}</span>
        <button
          type="button"
          onClick={() => {
            setStep("phone")
            setError(null)
          }}
          className="inline-flex cursor-pointer items-center gap-1 rounded text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Pencil className="size-3.5" /> ویرایش شماره
        </button>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <Label htmlFor="code" className="self-start">کد تأیید</Label>
        <InputOTP
          id="code"
          name="code"
          maxLength={6}
          autoComplete="one-time-code"
          pattern="[0-9]*"
          inputMode="numeric"
          required
          dir="ltr"
          value={code}
          onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={!!error}
          containerClassName="justify-center gap-2"
        >
          <InputOTPGroup className="gap-2">
            <InputOTPSlot index={0} className="size-12 rounded-2xl border text-lg" />
            <InputOTPSlot index={1} className="size-12 rounded-2xl border text-lg" />
            <InputOTPSlot index={2} className="size-12 rounded-2xl border text-lg" />
            <InputOTPSlot index={3} className="size-12 rounded-2xl border text-lg" />
            <InputOTPSlot index={4} className="size-12 rounded-2xl border text-lg" />
            <InputOTPSlot index={5} className="size-12 rounded-2xl border text-lg" />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-1 h-11" disabled={loading || code.length < 6}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        ورود
      </Button>

      <button
        type="button"
        onClick={() => requestCode()}
        disabled={cooldown > 0 || loading}
        className="mx-auto cursor-pointer rounded-full px-3 py-1.5 text-center text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cooldown > 0 ? `ارسال مجدد کد (${faNum(cooldown)})` : "ارسال مجدد کد"}
      </button>
    </form>
    </div>
  )
}
