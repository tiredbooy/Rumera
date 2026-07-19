"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { AlertCircle, Loader2, Smartphone, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { focusFormControl } from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { AuthClientError, requestOtp } from "@/features/auth/api/client"
import type { RequestOtpInput, VerifyOtpInput } from "@/features/auth/types"
import { safeCallbackUrl } from "@/features/auth/redirects"
import { faNum } from "@/lib/products"

const RESEND_SECONDS = 60
const OTP_LENGTH = 6

/**
 * PhoneLoginForm — SMS OTP login in two steps: enter phone → enter the 6-digit
 * code. Requesting the code goes through the same-origin `/api/public` proxy;
 * verifying it uses next-auth's "otp" credentials provider (server-side).
 */
export function PhoneLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const returnTo = safeCallbackUrl(callbackUrl)
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

  async function requestCode(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault()
    const formElement = e?.currentTarget instanceof HTMLFormElement ? e.currentTarget : null
    setError(null)
    setLoading(true)
    try {
      const input: RequestOtpInput = { phone: phone.trim() }
      await requestOtp(input)
      setStep("code")
      setCode("")
      setCooldown(RESEND_SECONDS)
    } catch (error) {
      setError(
        error instanceof AuthClientError
          ? error.status === 429
            ? "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید."
            : "شماره موبایل نامعتبر است."
          : "ارتباط با سرور برقرار نشد.",
      )
      if (formElement) focusFormControl(formElement, "phone")
    } finally {
      setLoading(false)
    }
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formElement = e.currentTarget
    setError(null)
    setLoading(true)
    const input: VerifyOtpInput = { phone: phone.trim(), code: code.trim() }
    const res = await signIn("otp", { ...input, redirect: false })
    if (!res || res.error) {
      setError("کد واردشده نادرست یا منقضی شده است.")
      setLoading(false)
      focusFormControl(formElement, "code")
      return
    }
    router.push(returnTo)
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
            aria-describedby={error ? "phone-hint phone-error" : "phone-hint"}
            className="h-11 text-start"
          />
          <p id="phone-hint" className="text-xs text-muted-foreground">
            کد تأیید به این شماره پیامک می‌شود.
          </p>
        </div>

        {error ? (
          <p
            id="phone-error"
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
          maxLength={OTP_LENGTH}
          autoComplete="one-time-code"
          pattern="[0-9]*"
          inputMode="numeric"
          required
          dir="ltr"
          value={code}
          onChange={(value) =>
            setCode(value.replace(/\D/g, "").slice(0, OTP_LENGTH))
          }
          aria-invalid={!!error}
          aria-describedby={error ? "code-error" : undefined}
          containerClassName="w-full min-w-0 justify-center"
        >
          <InputOTPGroup className="grid w-full max-w-[328px] grid-cols-6 justify-items-center gap-1 sm:gap-2">
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="aspect-square h-auto w-full min-w-0 max-w-12 rounded-xl border text-base sm:rounded-2xl sm:text-lg"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? (
        <p
          id="code-error"
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
