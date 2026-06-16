"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") ?? "").trim()
    const password = String(form.get("password") ?? "")

    try {
      // Same-origin proxy → backend /auth/register (works in dev, Docker & prod).
      const res = await fetch("/api/public/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: String(form.get("first_name") ?? "").trim(),
          last_name: String(form.get("last_name") ?? "").trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(
          body?.error?.code === "USER_ALREADY_EXISTS"
            ? "این ایمیل قبلاً ثبت شده است."
            : "ثبت‌نام ناموفق بود. ورودی‌ها را بررسی کنید."
        )
        setLoading(false)
        return
      }
      // Account created → sign in immediately for a seamless first session.
      const signed = await signIn("credentials", { email, password, redirect: false })
      if (!signed || signed.error) {
        router.push("/login")
        return
      }
      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError("ارتباط با سرور برقرار نشد.")
      setLoading(false)
    }
  }

  return (
    <div>
      <span className="eyebrow">عضویت</span>
      <h1 className="mt-2 font-serif text-3xl">ساخت حساب</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        برای خرید و پیگیری سفارش‌ها، حساب بسازید.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="first_name">نام</Label>
            <Input
              id="first_name"
              name="first_name"
              autoComplete="given-name"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last_name">نام خانوادگی</Label>
            <Input
              id="last_name"
              name="last_name"
              autoComplete="family-name"
              className="h-11"
            />
          </div>
        </div>
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
            className="h-11 text-start"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">گذرواژه</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            aria-describedby="password-hint"
            aria-invalid={!!error}
            className="h-11 text-start"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            حداقل ۸ کاراکتر.
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
          {loading ? <Loader2 className="animate-spin" /> : null}
          ساخت حساب
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        حساب دارید؟{" "}
        <Link
          href="/login"
          className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          ورود
        </Link>
      </p>
    </div>
  )
}
