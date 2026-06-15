"use client"

import * as React from "react"
import { Loader2, Gift } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRedeemGiftCard } from "@/lib/api/hooks"
import { formatPrice } from "@/lib/products"
import { ApiClientError } from "@/lib/api/store-client"

/** GiftCardRedeem — enter a gift-card code to top up the wallet. */
export function GiftCardRedeem() {
  const redeem = useRedeemGiftCard()
  const [code, setCode] = React.useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    redeem.mutate(code.trim(), {
      onSuccess: (res) => {
        setCode("")
        toast.success(`${formatPrice(res.amount)} به کیف پول شما افزوده شد`)
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiClientError && (e.code === "NOT_FOUND" || e.status === 404)
            ? "کد نامعتبر است یا قبلاً استفاده شده"
            : "استفاده از کارت هدیه ناموفق بود"
        ),
    })
  }

  return (
    <form
      onSubmit={submit}
      className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5"
    >
      <h2 className="flex items-center gap-2 font-serif text-2xl">
        <Gift className="size-5 text-primary" /> کارت هدیه
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        کد کارت هدیه را وارد کنید تا به موجودی کیف پول افزوده شود.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          dir="ltr"
          className="h-11 min-w-0 flex-1 text-start tracking-widest"
        />
        <Button type="submit" disabled={redeem.isPending || !code.trim()} className="h-11 cursor-pointer">
          {redeem.isPending ? <Loader2 className="animate-spin" /> : <Gift className="size-4" />}
          استفاده
        </Button>
      </div>
    </form>
  )
}
