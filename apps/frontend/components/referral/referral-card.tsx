"use client"

import * as React from "react"
import { Loader2, Users, Copy, Check, Share2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useReferral } from "@/lib/api/hooks"
import { faNum } from "@/lib/products"

/** ReferralCard — shows the customer's invite code, a shareable link, and stats. */
export function ReferralCard() {
  const { data, isLoading } = useReferral()
  const [copied, setCopied] = React.useState(false)

  if (isLoading || !data) {
    return (
      <div className="border-hairline flex h-40 items-center justify-center rounded-3xl bg-card ring-1 ring-foreground/5">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${data.code}`
      : `/?ref=${data.code}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success("لینک دعوت کپی شد")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("کپی ناموفق بود")
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "رومرا", text: "به رومرا بپیوند", url: link })
      } catch {
        /* user cancelled */
      }
    } else {
      copy()
    }
  }

  return (
    <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
      <h2 className="flex items-center gap-2 font-serif text-2xl">
        <Users className="size-5 text-primary" /> دعوت دوستان
      </h2>
      <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
        با هر دعوت موفق، شما و دوستتان هرکدام {faNum(data.reward)} امتیاز می‌گیرید.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor="referral-link">لینک دعوت شما</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="referral-link"
            value={link}
            readOnly
            dir="ltr"
            className="h-11 min-w-0 flex-1 text-start"
          />
          <Button onClick={copy} variant="outline" className="h-11 cursor-pointer" aria-label="کپی لینک دعوت">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} کپی
          </Button>
          <Button onClick={share} className="h-11 cursor-pointer">
            <Share2 className="size-4" /> اشتراک‌گذاری
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-secondary/60 py-4">
          <p className="font-serif text-3xl text-foil">{faNum(data.completed)}</p>
          <p className="mt-1 text-xs text-muted-foreground">دعوت موفق</p>
        </div>
        <div className="rounded-2xl bg-secondary/60 py-4">
          <p className="font-serif text-3xl">{faNum(data.pending)}</p>
          <p className="mt-1 text-xs text-muted-foreground">در انتظار</p>
        </div>
      </div>
    </div>
  )
}
