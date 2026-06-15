"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm() {
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    // The endpoint always returns 202 (enumeration-safe); we mirror that in the UI.
    await fetch("/api/public/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(form.get("email") ?? "").trim() }),
    }).catch(() => null)
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <MailCheck className="size-6" />
        </div>
        <h1 className="font-serif text-2xl">ایمیل را بررسی کنید</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اگر این ایمیل در سیستم ثبت شده باشد، لینک بازیابی گذرواژه برایتان ارسال
          می‌شود.
        </p>
        <Button asChild variant="outline" className="mt-6 h-11 w-full">
          <Link href="/login">بازگشت به ورود</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-3xl">بازیابی گذرواژه</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ایمیل حساب خود را وارد کنید تا لینک بازیابی ارسال شود.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">ایمیل</Label>
          <Input id="email" name="email" type="email" required dir="ltr" placeholder="you@example.com" />
        </div>
        <Button type="submit" size="lg" className="mt-1 h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          ارسال لینک بازیابی
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          بازگشت به ورود
        </Link>
      </p>
    </div>
  )
}
