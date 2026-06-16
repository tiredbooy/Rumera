"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Sparkles, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RecommendationRail } from "@/components/catalog/recommendation-rail"
import { useTasteProfile, useForYou } from "@/lib/api/hooks"
import type { Category } from "@/lib/products"

/**
 * ForYouRail — a personalised strip on the home page. Signed-in shoppers who
 * have set a taste profile see products from the recommendation engine
 * (`/recommendations/for-you`); those who haven't get a gentle CTA to take the
 * quiz. Signed-out visitors see nothing (keeps the cacheable hero clean).
 */
export function ForYouRail() {
  const { status } = useSession()
  const authed = status === "authenticated"
  const taste = useTasteProfile(authed)
  const forYou = useForYou(authed)

  if (!authed || taste.isLoading) return null

  const cats = (taste.data?.categories ?? []) as Category[]

  // No preferences yet → invite the shopper to take the quiz.
  if (cats.length === 0) {
    return (
      <section className="container-px mx-auto max-w-7xl py-10">
        <div className="cellar-glow border-hairline flex flex-col items-start gap-4 rounded-3xl px-6 py-8 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div>
            <p className="eyebrow mb-2"><Sparkles className="size-3.5" /> شخصی‌سازی</p>
            <h2 className="font-serif text-2xl sm:text-3xl">سلیقه‌تان را به ما بگویید</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              در کمتر از یک دقیقه، پیشنهادها را مخصوص خودتان کنید.
            </p>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0 px-6">
            <Link href="/account/taste">شروع کنید <ArrowLeft /></Link>
          </Button>
        </div>
      </section>
    )
  }

  const items = forYou.data ?? []
  if (forYou.isLoading || items.length === 0) return null

  return (
    <RecommendationRail
      items={items.slice(0, 4)}
      eyebrow="برای شما"
      title="بر اساس سلیقهٔ شما"
      icon={Sparkles}
      className="container-px mx-auto max-w-7xl py-12"
    />
  )
}
