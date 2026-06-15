"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Sparkles, ArrowLeft, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTasteProfile } from "@/lib/api/hooks"
import { categoryFa, formatPrice, type Category } from "@/lib/products"

/**
 * ForYouRail — a personalised strip on the home page. Authenticated shoppers who
 * have taken the taste quiz see quick links to their favourite categories; those
 * who haven't get a gentle CTA to take it. Signed-out visitors see nothing
 * (keeps the public, cacheable hero clean). Per-user, so it's client-rendered.
 */
export function ForYouRail() {
  const { status } = useSession()
  const authed = status === "authenticated"
  const { data, isLoading } = useTasteProfile(authed)

  if (!authed || isLoading) return null

  const cats = (data?.categories ?? []) as Category[]
  const budget = data?.budget_max ?? 0

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

  return (
    <section className="container-px mx-auto max-w-7xl py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2"><Sparkles className="size-3.5" /> برای شما</p>
          <h2 className="font-serif text-3xl sm:text-4xl">بر اساس سلیقهٔ شما</h2>
        </div>
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/account/taste">ویرایش سلیقه</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {cats.slice(0, 4).map((c) => (
          <Link
            key={c}
            href={`/categories/${c.toLowerCase()}`}
            className="group/foryou border-hairline relative flex items-center justify-between gap-2 overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:ring-primary/30 sm:p-5"
          >
            <span className="font-serif text-lg sm:text-xl">{categoryFa[c]}</span>
            <ArrowLeft className="size-4 -translate-x-1 text-primary opacity-0 transition-all group-hover/foryou:translate-x-0 group-hover/foryou:opacity-100" />
          </Link>
        ))}
      </div>

      {budget > 0 ? (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
          <Wallet className="size-3.5" /> بودجهٔ دلخواه شما: تا {formatPrice(budget)}
        </p>
      ) : null}
    </section>
  )
}
