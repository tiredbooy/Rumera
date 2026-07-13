"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Star, ThumbsUp, ShieldCheck, PenLine, MessageSquare, Loader2, X } from "lucide-react"
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
import type {
  CreateReviewInput,
  ProductRatingSummary,
  Review,
  ReviewRating,
  ReviewRatingKey,
  ReviewReactionInput,
} from "@/features/reviews/types"
import { fetchReviewsPage } from "@/features/reviews/actions"
import {
  ReviewMutationError,
  useCreateReview,
  useReactToReview,
} from "@/features/reviews/hooks"
import { useRecordInteraction } from "@/features/recommendations/hooks"

const PAGE_SIZE = 8

/** Read-only star row. */
function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${faNum(value)} از ۵ ستاره`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
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
 * ReviewsSection — PDP reviews block. Renders the server-fetched summary + first
 * page; lets shoppers filter by star rating, load more pages (via a Server
 * Action), write a review (signed-in, optimistic), and mark reviews helpful.
 * Guests see a prompt to sign in.
 */
export function ReviewsSection({
  productId,
  summary,
  initialReviews,
  initialHasNext,
}: {
  productId: number
  summary: ProductRatingSummary | null
  initialReviews: Review[]
  initialHasNext: boolean
}) {
  const { status } = useSession()
  const authed = status === "authenticated"

  const [reviews, setReviews] = React.useState<Review[]>(initialReviews)
  const [reacted, setReacted] = React.useState<Set<number>>(new Set())
  const [filter, setFilter] = React.useState<ReviewRating | null>(null)
  const [page, setPage] = React.useState(1)
  const [hasNext, setHasNext] = React.useState(initialHasNext)
  const [loading, setLoading] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  // Newly written reviews (pending moderation) — kept across filter changes so
  // the author sees their submission immediately.
  const [pending, setPendingReviews] = React.useState<Review[]>([])
  const reactMutation = useReactToReview(productId)

  const total = summary?.total_reviews ?? reviews.length
  const avg = summary?.average_rating ?? 0

  // Apply a star filter → refetch page 1 from the server.
  function applyFilter(rating: ReviewRating | null) {
    if (rating === filter) return
    setFilter(rating)
    setLoading(true)
    startTransition(async () => {
      const res = await fetchReviewsPage(productId, {
        page: 1,
        limit: PAGE_SIZE,
        ...(rating ? { rating } : {}),
      })
      setReviews(res.reviews)
      setHasNext(res.hasNext)
      setPage(1)
      setLoading(false)
    })
  }

  function loadMore() {
    const next = page + 1
    setLoading(true)
    startTransition(async () => {
      const res = await fetchReviewsPage(productId, {
        page: next,
        limit: PAGE_SIZE,
        ...(filter ? { rating: filter } : {}),
      })
      setReviews((rs) => [...rs, ...res.reviews])
      setHasNext(res.hasNext)
      setPage(next)
      setLoading(false)
    })
  }

  async function react(id: number) {
    if (!authed) {
      toast.info("برای ثبت بازخورد وارد شوید")
      return
    }
    if (reacted.has(id)) return
    setReacted((s) => new Set(s).add(id))
    const bump = (delta: number) =>
      setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, like_count: r.like_count + delta } : r)))
    bump(1)
    try {
      const input: ReviewReactionInput = { like: true }
      await reactMutation.mutateAsync({ id, input })
    } catch {
      bump(-1)
      setReacted((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
      toast.error("ثبت بازخورد ناموفق بود")
    }
  }

  // Pending (own, unapproved) reviews shown atop the list; de-duped from the feed.
  const visible = filter ? [] : pending
  const merged = [...visible, ...reviews]

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
            <div className="mt-6 space-y-1.5" role="group" aria-label="پالایش بر اساس امتیاز">
              {([5, 4, 3, 2, 1] as ReviewRating[]).map((star) => {
                const count = summary.distribution[String(star) as ReviewRatingKey] ?? 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                const isActive = filter === star
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => applyFilter(isActive ? null : star)}
                    aria-pressed={isActive}
                    disabled={count === 0}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors enabled:cursor-pointer enabled:hover:bg-secondary/60 disabled:opacity-50",
                      isActive && "bg-secondary"
                    )}
                  >
                    <span className="w-3 text-end tabular-nums">{faNum(star)}</span>
                    <Star className="size-3 fill-primary/70 text-primary/70" aria-hidden />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-8 text-start tabular-nums">{faNum(count)}</span>
                  </button>
                )
              })}
              {filter ? (
                <button
                  type="button"
                  onClick={() => applyFilter(null)}
                  className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs text-primary hover:underline"
                >
                  <X className="size-3" /> حذف پالایش
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6">
            {authed ? (
              <WriteReviewDialog
                productId={productId}
                onCreated={(r) => setPendingReviews((rs) => [r, ...rs])}
              />
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">برای ثبت نظر وارد شوید</Link>
              </Button>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              فقط خریداران می‌توانند برای این محصول نظر ثبت کنند.
            </p>
          </div>
        </div>

        {/* List */}
        <div aria-busy={loading || isPending}>
          {merged.length === 0 ? (
            <div className="border-hairline flex flex-col items-center rounded-3xl bg-card/40 px-6 py-16 text-center ring-1 ring-foreground/5">
              <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageSquare className="size-6" />
              </span>
              <p className="font-medium">
                {filter ? `نظری با ${faNum(filter)} ستاره یافت نشد` : "هنوز نظری ثبت نشده"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filter ? "پالایش را بردارید تا همهٔ نظرها را ببینید." : "اولین نفری باشید که تجربه‌اش را می‌نویسد."}
              </p>
            </div>
          ) : (
            <ul className="space-y-5">
              {merged.map((r, i) => {
                const isPendingRow = i < visible.length
                return (
                  <li
                    key={`${isPendingRow ? "p" : "r"}-${r.id}`}
                    className="border-hairline rounded-2xl bg-card/50 p-5 ring-1 ring-foreground/5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Stars value={r.rating} />
                      <span className="text-xs text-muted-foreground">{faDate(r.created_at)}</span>
                    </div>
                    {r.title ? <h3 className="mt-3 font-serif text-lg leading-tight">{r.title}</h3> : null}
                    {r.content ? (
                      <p className="mt-2 leading-relaxed text-muted-foreground">{r.content}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {isPendingRow ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          در انتظار تأیید
                        </span>
                      ) : r.verified_purchase ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          <ShieldCheck className="size-3.5" /> خرید تأییدشده
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">خریدار</span>
                      )}
                      {!isPendingRow ? (
                        <button
                          type="button"
                          onClick={() => react(r.id)}
                          disabled={reacted.has(r.id)}
                          className={cn(
                            "ms-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-default disabled:opacity-60",
                            reacted.has(r.id) && "border-primary/40 text-primary"
                          )}
                          aria-label="این نظر مفید بود"
                        >
                          <ThumbsUp className="size-3.5" /> مفید بود
                          {r.like_count > 0 ? <span>({faNum(r.like_count)})</span> : null}
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {hasNext ? (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loading || isPending}>
                {loading || isPending ? <Loader2 className="animate-spin" /> : null}
                نمایش نظرهای بیشتر
              </Button>
            </div>
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
  const [rating, setRating] = React.useState<ReviewRating>(5)
  const [hover, setHover] = React.useState(0)
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const createReview = useCreateReview(productId)
  const recordInteraction = useRecordInteraction()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    try {
      const input: CreateReviewInput = {
        product_id: productId,
        rating,
        title: title.trim(),
        content: content.trim(),
      }
      const review = await createReview.mutateAsync(input)
      onCreated(review)
      recordInteraction.mutate({
        product_id: productId,
        interaction_type: "review",
        source: "pdp",
      })
      toast.success("نظر شما ثبت شد", { description: "پس از تأیید نمایش داده می‌شود." })
      setOpen(false)
      setTitle("")
      setContent("")
      setRating(5)
    } catch (error) {
      if (error instanceof ReviewMutationError && error.status === 409) {
        toast.error("قبلاً برای این محصول نظر ثبت کرده‌اید")
        return
      }
      if (error instanceof ReviewMutationError && error.status === 403) {
        toast.error("تنها خریداران این محصول می‌توانند نظر ثبت کنند")
        return
      }
      toast.error("ثبت نظر ناموفق بود. دوباره تلاش کنید.")
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
              {([1, 2, 3, 4, 5] as ReviewRating[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={`${faNum(n)} ستاره`}
                  aria-pressed={rating === n}
                  className="cursor-pointer p-0.5"
                >
                  <Star
                    aria-hidden
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
            <Label htmlFor="review-title" className="mb-2 block">عنوان</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
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
            <Button
              type="submit"
              disabled={createReview.isPending || !title.trim() || !content.trim()}
            >
              {createReview.isPending ? <Loader2 className="animate-spin" /> : null}
              {createReview.isPending ? "در حال ثبت…" : "ثبت نظر"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
