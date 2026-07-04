"use client"

import * as React from "react"
import { Star, Check, X, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { faNum } from "@/lib/products"
import { cn } from "@/lib/utils"
import { adminReviews, type AdminReview, type ReviewStatus } from "@/lib/admin/data"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReviewBadge } from "@/components/admin/status-badge"

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} از ۵`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < rating ? "fill-gold text-gold" : "fill-muted text-muted"
          )}
        />
      ))}
    </span>
  )
}

const TABS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "pending", label: "در انتظار بازبینی" },
  { value: "approved", label: "تأییدشده" },
  { value: "rejected", label: "ردشده" },
]

export function ReviewsQueue({ canModerate }: { canModerate: boolean }) {
  const [tab, setTab] = React.useState<ReviewStatus | "all">("pending")

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: adminReviews.length, pending: 0, approved: 0, rejected: 0 }
    for (const r of adminReviews) c[r.status]++
    return c
  }, [])

  const rows = tab === "all" ? adminReviews : adminReviews.filter((r) => r.status === tab)

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewStatus | "all")}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              <span className="ms-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {faNum(counts[t.value])}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rows.length === 0 ? (
        <div className="border-hairline flex flex-col items-center justify-center gap-3 rounded-2xl border-dashed bg-card/40 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border/60">
            <Star className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">دیدگاهی در این بخش نیست.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((review) => (
            <ReviewCard key={review.id} review={review} canModerate={canModerate} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReviewCard({ review, canModerate }: { review: AdminReview; canModerate: boolean }) {
  return (
    <li className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] transition-colors hover:ring-foreground/[0.08]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-serif text-primary ring-1 ring-primary/15">
            {review.reviewer.trim().charAt(0)}
          </span>
          <div className="leading-tight">
            <p className="font-medium">{review.reviewer}</p>
            <p className="text-xs text-muted-foreground">
              دربارهٔ <span className="text-foreground">{review.productName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Stars rating={review.rating} />
          <ReviewBadge status={review.status} />
        </div>
      </div>

      <p className="mt-3 font-medium">{review.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{review.body}</p>

      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
        <span className="text-xs text-muted-foreground" dir="ltr">{review.date}</span>
        {canModerate ? (
          <div className="flex items-center gap-2">
            {review.status !== "approved" ? (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"
                onClick={() => toast.success("دیدگاه تأیید شد (نمونه)")}
              >
                <Check className="size-4" /> تأیید
              </Button>
            ) : null}
            {review.status !== "rejected" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("دیدگاه رد شد (نمونه)")}
              >
                <X className="size-4" /> رد
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label="حذف"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => toast.success("دیدگاه حذف شد (نمونه)")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  )
}
