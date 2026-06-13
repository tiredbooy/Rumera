"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const res = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    })
    if (!res || res.error) {
      setError("ایمیل یا گذرواژه نادرست است.")
      setLoading(false)
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div>
      <h1 className="font-serif text-3xl">ورود به حساب</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        برای ادامه، وارد حساب کاربری خود شوید.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">ایمیل</Label>
          <Input id="email" name="email" type="email" required dir="ltr" placeholder="you@example.com" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">گذرواژه</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              فراموشی گذرواژه؟
            </Link>
          </div>
          <Input id="password" name="password" type="password" required dir="ltr" />
        </div>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-1 h-11" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          ورود
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        حساب ندارید؟{" "}
        <Link href="/register" className="text-primary hover:underline">
          ساخت حساب جدید
        </Link>
      </p>
    </div>
  )
}
