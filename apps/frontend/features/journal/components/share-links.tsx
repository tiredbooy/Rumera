"use client"

import * as React from "react"
import { Send, Share2, Copy, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

// Read `navigator.share` availability without a setState-in-effect: a stable
// client snapshot (the capability never changes during a session) and a `false`
// server snapshot keep hydration consistent and avoid cascading renders.
const subscribe = () => () => {}
const getNativeShareSnapshot = () => typeof navigator !== "undefined" && "share" in navigator
const getNativeShareServerSnapshot = () => false

/**
 * ShareLinks — share affordances for a journal article.
 *
 * Telegram + X open prefilled intents in a new tab; the native share sheet
 * appears on devices that support `navigator.share`; and "copy link" writes the
 * URL to the clipboard with a sonner toast + a check-mark confirmation. All
 * controls have Persian accessible names and 44px touch targets.
 */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = React.useState(false)
  const canNativeShare = React.useSyncExternalStore(
    subscribe,
    getNativeShareSnapshot,
    getNativeShareServerSnapshot
  )

  const text = encodeURIComponent(title)
  const link = encodeURIComponent(url)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("لینک کپی شد")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("کپی ناموفق بود")
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url })
    } catch {
      // User dismissed the sheet — no error toast needed.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://t.me/share/url?url=${link}&text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="هم‌رسانی در تلگرام"
        >
          <Send className="size-4" aria-hidden /> تلگرام
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://twitter.com/intent/tweet?url=${link}&text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="هم‌رسانی در ایکس (توییتر)"
        >
          ایکس (توییتر)
        </a>
      </Button>
      {canNativeShare ? (
        <Button
          variant="outline"
          size="sm"
          onClick={nativeShare}
          className="cursor-pointer"
          aria-label="هم‌رسانی"
        >
          <Share2 className="size-4" aria-hidden /> هم‌رسانی
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={copy}
        className="cursor-pointer"
        aria-label="کپی لینک نوشته"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        کپی لینک
      </Button>
    </div>
  )
}
