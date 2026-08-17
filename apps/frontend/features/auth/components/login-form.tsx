"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { focusFormControl } from "@/components/ui/field"
import type { SignInInput } from "@/features/auth/types"
import { safeCallbackUrl } from "@/features/auth/redirects"

const SIGN_IN_CODE_COPY: Record<string, string> = {
  RateLimited: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
  Inactive: "این حساب غیرفعال است. در صورت نیاز با پشتیبانی تماس بگیرید.",
  AuthServiceError: "ارتباط با سرور برقرار نشد.",
  Configuration: "ارتباط با سرور برقرار نشد.",
}

/** Map Auth.js `signIn({ redirect: false })` result to Persian (no secrets). */
export function signInErrorMessage(
  result: { error?: string | null; code?: string | null } | null | undefined,
  invalidCredentials: string,
): string {
  if (!result) return SIGN_IN_CODE_COPY.AuthServiceError
  const code = result.code?.trim()
  const key =
    code && code !== "credentials" && code !== "CredentialsSignin"
      ? code
      : (result.error?.trim() ?? "")
  return SIGN_IN_CODE_COPY[key] ?? invalidCredentials
}

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const returnTo = safeCallbackUrl(callbackUrl)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formElement = e.currentTarget
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const input: SignInInput = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    }
    const res = await signIn("credentials", {
      ...input,
      redirect: false,
    })
    if (!res || res.error) {
      setError(
        signInErrorMessage(res, "ایمیل یا گذرواژه نادرست است."),
      )
      setLoading(false)
      focusFormControl(formElement, "email")
      return
    }
    router.push(returnTo)
    router.refresh()
  }

  return (
    <div>
      <span className="eyebrow">ورود با ایمیل</span>
      <h1 className="mt-2 font-serif text-3xl">ورود به حساب</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        برای ادامه، وارد حساب کاربری خود شوید.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">ایمیل</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            className="h-11 text-start"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">گذرواژه</Label>
            <Link
              href="/forgot-password"
              className="rounded text-xs text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              فراموشی گذرواژه؟
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            dir="ltr"
            autoComplete="current-password"
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            className="h-11 text-start"
          />
        </div>

        {error ? (
          <p
            id="login-error"
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-1 h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          ورود
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        حساب ندارید؟{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(returnTo)}`}
          className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          ساخت حساب جدید
        </Link>
      </p>
    </div>
  )
}
