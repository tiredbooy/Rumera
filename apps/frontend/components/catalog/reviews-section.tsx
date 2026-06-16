"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Star, ThumbsUp, ShieldCheck, PenLine, MessageSquare } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Review, RatingSummary } from "@/lib/catalog/reviews"

/** Read-only star row. */
function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} از ۵`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-4",
            n <= Math.round(value) ? "fill-primary text-primary" : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  )
}

function faDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return ""
  }
}

/**
 * ReviewsSection — PDP reviews block. Renders the server-fetched summary +
 * first page; lets signed-in shoppers write a review (optimistic) and mark
 * reviews helpful. Guests see a prompt to sign in.
 */
export function ReviewsSection({
  productId,
  summary,
  initialReviews,
}: {
  productId: number
  summary: RatingSummary | null
  initialReviews: Review[]
}) {
  const { status } = useSession()
  const authed = status === "authenticated"

  const [reviews, setReviews] = React.useState<Review[]>(initialReviews)
  const [reacted, setReacted] = React.useState<Set<number>>(new Set())
  const total = summary?.total_reviews ?? reviews.length
  const avg = summary?.average_rating ?? 0

  async function react(id: number) {
    if (!authed) {
      toast.info("برای ثبت بازخورد وارد شوید")
      return
    }
    if (reacted.has(id)) return
    setReacted((s) => new Set(s).add(id))
    setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, like_count: r.like_count + 1 } : r)))
    try {
      const res = await fetch(`/api/store/reviews/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ like: true }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, like_count: r.like_count - 1 } : r)))
      setReacted((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
      toast.error("ثبت بازخورد ناموفق بود")
    }
  }

  return (
    <section className="container-px mx-auto max-w-7xl py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-14">
        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow mb-3">
            <MessageSquare className="size-3.5" /> نظرات خریداران
          </p>
          <div className="flex items-end gap-3">
            <span className="font-serif text-5xl text-foil">{faNum(Number(avg.toFixed(1)))}</span>
            <div className="pb-1.5">
              <Stars value={avg} />
              <p className="mt-1 text-sm text-muted-foreground">{faNum(total)} نظر</p>
            </div>
          </div>

          {summary && total > 0 ? (
            <div className="mt-6 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.distribution[String(star) as "1"] ?? 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-3 text-end">{faNum(star)}</span>
                    <Star className="size-3 fill-primary/70 text-primary/70" />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 text-start">{faNum(count)}</span>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-6">
            {authed ? (
              <WriteReviewDialog
                productId={productId}
                onCreated={(r) => setReviews((rs) => [r, ...rs])}
              />
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">برای ثبت نظر وارد شوید</Link>
              </Button>
            )}
          </div>
        </div>

        {/* List */}
        <div>
          {reviews.length === 0 ? (
            <div className="border-hairline flex flex-col items-center rounded-3xl bg-card/40 px-6 py-16 text-center ring-1 ring-foreground/5">
              <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageSquare className="size-6" />
              </span>
              <p className="font-medium">هنوز نظری ثبت نشده</p>
              <p className="mt-1 text-sm text-muted-foreground">اولین نفری باشید که تجربه‌اش را می‌نویسد.</p>
            </div>
          ) : (
            <ul className="space-y-5">
              {reviews.map((r) => (
                <li key={r.id} className="border-hairline rounded-2xl bg-card/50 p-5 ring-1 ring-foreground/5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={r.rating} />
                    <span className="text-xs text-muted-foreground">{faDate(r.created_at)}</span>
                  </div>
                  {r.title ? <h3 className="mt-3 font-serif text-lg leading-tight">{r.title}</h3> : null}
                  {r.content ? <p className="mt-2 leading-relaxed text-muted-foreground">{r.content}</p> : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {r.verified_purchase ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <ShieldCheck className="size-3.5" /> خرید تأییدشده
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">خریدار</span>
                    )}
                    <button
                      type="button"
                      onClick={() => react(r.id)}
                      disabled={reacted.has(r.id)}
                      className={cn(
                        "ms-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-default disabled:opacity-60",
                        reacted.has(r.id) && "border-primary/40 text-primary"
                      )}
                      aria-label="مفید بود"
                    >
                      <ThumbsUp className="size-3.5" /> مفید بود
                      {r.like_count > 0 ? <span>({faNum(r.like_count)})</span> : null}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {total > reviews.length ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {faNum(reviews.length)} نظر از {faNum(total)} نظر نمایش داده شده است.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function WriteReviewDialog({
  productId,
  onCreated,
}: {
  productId: number
  onCreated: (r: Review) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [rating, setRating] = React.useState(5)
  const [hover, setHover] = React.useState(0)
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || rating < 1) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, rating, title: title.trim(), content: content.trim() }),
      })
      if (res.status === 409) {
        toast.error("قبلاً برای این محصول نظر ثبت کرده‌اید")
        return
      }
      if (!res.ok) throw new Error()
      const body = (await res.json()) as { data: Review }
      onCreated(body.data)
      toast.success("نظر شما ثبت شد", { description: "پس از تأیید نمایش داده می‌شود." })
      setOpen(false)
      setTitle("")
      setContent("")
      setRating(5)
    } catch {
      toast.error("ثبت نظر ناموفق بود. دوباره تلاش کنید.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <PenLine /> ثبت نظر
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">نظر شما</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label className="mb-2 block">امتیاز شما</Label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${n} ستاره`}
                  className="cursor-pointer p-0.5"
                >
                  <Star
                    className={cn(
                      "size-7 transition-colors",
                      n <= (hover || rating) ? "fill-primary text-primary" : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="review-title" className="mb-2 block">عنوان (اختیاری)</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="جمع‌بندی تجربه‌تان"
            />
          </div>
          <div>
            <Label htmlFor="review-content" className="mb-2 block">متن نظر</Label>
            <Textarea
              id="review-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={4}
              placeholder="از کیفیت، طعم و تجربهٔ خریدتان بنویسید…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !content.trim()}>
              {submitting ? "در حال ثبت…" : "ثبت نظر"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
