"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password") ?? "")
    if (password !== String(form.get("confirm") ?? "")) {
      setError("گذرواژه‌ها یکسان نیستند.")
      return
    }
    setLoading(true)
    const res = await fetch("/api/public/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: password }),
    }).catch(() => null)

    if (!res || !res.ok) {
      setError("لینک بازیابی نامعتبر یا منقضی شده است.")
      setLoading(false)
      return
    }
    router.push("/login")
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="font-serif text-2xl">لینک نامعتبر</h1>
        <p className="mt-2 text-sm text-muted-foreground">
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
      <h1 className="font-serif text-3xl">گذرواژهٔ جدید</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        گذرواژهٔ تازه‌ای برای حساب خود انتخاب کنید.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">گذرواژهٔ جدید</Label>
          <Input id="password" name="password" type="password" required minLength={8} dir="ltr" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">تکرار گذرواژه</Label>
          <Input id="confirm" name="confirm" type="password" required minLength={8} dir="ltr" />
        </div>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
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
