"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, ShieldX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { focusFormControl } from "@/components/ui/field"
import { resetPassword } from "@/features/auth/api/client"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formElement = e.currentTarget
    setError(null)
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirm") ?? "")) {
      setError("گذرواژه‌ها یکسان نیستند.")
      focusFormControl(formElement, "confirm")
      return
    }
    setLoading(true)
    try {
      await resetPassword({ token, new_password: password })
    } catch {
      setError("لینک بازیابی نامعتبر یا منقضی شده است.")
      setLoading(false)
      focusFormControl(formElement, "password")
      return
    }
    router.push("/login")
  }

  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <ShieldX className="size-6" />
        </div>
        <h1 className="font-serif text-2xl">لینک نامعتبر</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          این لینک بازیابی معتبر نیست. دوباره درخواست دهید.
        </p>
        <Button asChild variant="outline" className="mt-6 h-11 w-full">
          <Link href="/forgot-password">درخواست لینک جدید</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <span className="eyebrow">بازیابی حساب</span>
      <h1 className="mt-2 font-serif text-3xl">گذرواژهٔ جدید</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        گذرواژهٔ تازه‌ای برای حساب خود انتخاب کنید.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">گذرواژهٔ جدید</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            aria-invalid={!!error}
            aria-describedby={error ? "reset-password-error" : undefined}
            className="h-11 text-start"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">تکرار گذرواژه</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            aria-invalid={!!error}
            aria-describedby={error ? "reset-password-error" : undefined}
            className="h-11 text-start"
          />
        </div>

        {error ? (
          <p
            id="reset-password-error"
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-1 h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          ذخیرهٔ گذرواژه
        </Button>
      </form>
    </div>
  )
}
