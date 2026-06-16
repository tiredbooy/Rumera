import type { Metadata } from "next"
import Link from "next/link"
import { Search, SearchX, Sparkles, ArrowLeft } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { listProducts } from "@/lib/catalog/products"
import { listCategories } from "@/lib/catalog/categories"
import { faNum } from "@/lib/products"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/catalog/product-card"

export const metadata: Metadata = buildMetadata({ title: "جستجو", path: "/search", index: false })

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = "" } = await searchParams
  const query = q.trim()

  const [{ results }, categories] = await Promise.all([
    query ? listProducts({ search: query, limit: 24 }) : Promise.resolve({ results: [] as never[] }),
    listCategories(),
  ])

  return (
    <>
      {/* Search hero — on-page field so the page is usable on its own. */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-3xl py-14 text-center sm:py-16">
          <p className="eyebrow mb-3 justify-center">
            <Sparkles className="size-3.5" /> جستجو در رومرا
          </p>
          <h1 className="section-title">دنبال چه می‌گردید؟</h1>
          <form action="/search" role="search" className="relative mx-auto mt-8 max-w-xl">
            <Search className="pointer-events-none absolute top-1/2 start-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              autoFocus
              placeholder="نام محصول، برند یا دسته…"
              aria-label="جستجوی فروشگاه"
              className="h-14 w-full rounded-full border border-border/70 bg-background/80 ps-12 pe-28 text-base shadow-sm outline-none backdrop-blur-sm transition-all placeholder:text-muted-foreground/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <Button
              type="submit"
              className="absolute top-1/2 end-2 h-10 -translate-y-1/2 rounded-full px-5"
            >
              جستجو
            </Button>
          </form>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl py-12 sm:py-14">
        {query && results.length ? (
          <>
            <p className="text-muted-foreground">
              {`${faNum(results.length)} نتیجه برای «`}
              <span className="font-medium text-foreground">{query}</span>
              {"»"}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : query ? (
          /* No results */
          <div className="border-hairline mx-auto flex max-w-lg flex-col items-center rounded-3xl bg-card/40 px-6 py-14 text-center ring-1 ring-foreground/5">
            <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <SearchX className="size-7" />
            </span>
            <h2 className="font-serif text-2xl">
              نتیجه‌ای برای «{query}» پیدا نشد
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              املای عبارت را بررسی کنید یا با کلمهٔ کلی‌تری دوباره جستجو کنید. می‌توانید از دسته‌بندی‌ها هم شروع کنید.
            </p>
            <Button asChild className="mt-6">
              <Link href="/products">
                مرور همهٔ محصولات <ArrowLeft />
              </Link>
            </Button>
          </div>
        ) : (
          /* Idle — no query yet */
          <p className="text-center text-muted-foreground">عبارتی برای جستجو وارد کنید یا از دسته‌بندی‌ها شروع کنید.</p>
        )}

        {/* Category shortcuts — always offered as a starting point */}
        {categories.length ? (
          <div className="mt-14">
            <p className="eyebrow mb-4 justify-center text-center">جستجو بر اساس دسته</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className="rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </>
  )
}
