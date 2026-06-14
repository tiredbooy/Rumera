import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, UtensilsCrossed } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { Reveal } from "@/components/motion/reveal"
import { Button } from "@/components/ui/button"
import { RecipeCard } from "@/components/recipes/recipe-card"
import { RecipeFilters } from "@/components/recipes/recipe-filters"
import { listRecipes, type RecipeDifficulty, type RecipeListParams } from "@/lib/recipes"
import { faNum } from "@/lib/products"

export const revalidate = 3600

export const metadata: Metadata = buildMetadata({
  title: "دستورها و ایده‌ها",
  description:
    "دستورهای کوکتل و ایده‌های میزبانی — قابل جستجو و فیلتر، با محصولات پیشنهادی برای تهیهٔ هر دستور.",
  path: "/recipes",
})

const PAGE_SIZE = 12

type SearchParams = Promise<{
  q?: string
  difficulty?: string
  sort?: string
  page?: string
}>

function toParams(sp: Awaited<SearchParams>): RecipeListParams {
  const params: RecipeListParams = { limit: PAGE_SIZE }
  if (sp.q) params.search = sp.q
  if (sp.difficulty === "easy" || sp.difficulty === "medium" || sp.difficulty === "hard") {
    params.difficulty = sp.difficulty as RecipeDifficulty
  }
  switch (sp.sort) {
    case "popular":
      params.sortBy = "view_count"
      params.orderBy = "desc"
      break
    case "quick":
      params.sortBy = "total_time_minutes"
      params.orderBy = "asc"
      break
    default:
      params.sortBy = "published_at"
      params.orderBy = "desc"
  }
  const page = Number(sp.page)
  if (Number.isFinite(page) && page > 1) params.page = page
  return params
}

/** Build a /recipes?… href preserving current filters with an overridden page. */
function pageHref(sp: Awaited<SearchParams>, page: number): string {
  const params = new URLSearchParams()
  if (sp.q) params.set("q", sp.q)
  if (sp.difficulty) params.set("difficulty", sp.difficulty)
  if (sp.sort) params.set("sort", sp.sort)
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `/recipes?${qs}` : "/recipes"
}

export default async function RecipesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const { results: recipes, pagination } = await listRecipes(toParams(sp))

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "دستورها", path: "/recipes" },
        ])}
      />

      {/* Header */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-14">
          <Reveal>
            <p className="eyebrow mb-3">
              <UtensilsCrossed className="size-3.5" /> دستورها و ایده‌ها
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl">
              چه چیزی میل دارید بسازید؟
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              از کلاسیک‌های بی‌زمان تا ترکیب‌های تازه — جستجو کنید، فیلتر بزنید و
              محصولات لازم را مستقیم از همان صفحه تهیه کنید.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl py-10">
        <RecipeFilters />

        {/* Result count */}
        <p className="mt-6 text-sm text-muted-foreground">
          {pagination.total_items > 0
            ? `${faNum(pagination.total_items)} دستور یافت شد`
            : null}
        </p>

        {recipes.length === 0 ? (
          <div className="border-hairline mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-20 text-center ring-1 ring-foreground/5">
            <UtensilsCrossed className="size-10 text-muted-foreground/50" />
            <p className="font-serif text-2xl">دستوری پیدا نشد</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.
            </p>
            <Button variant="outline" asChild className="mt-2">
              <Link href="/recipes">نمایش همهٔ دستورها</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe, i) => (
              <Reveal key={recipe.id} delay={Math.min(i, 5) * 0.04} y={16}>
                <RecipeCard recipe={recipe} />
              </Reveal>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 ? (
          <div className="mt-12 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_prev}
              asChild={pagination.has_prev}
            >
              {pagination.has_prev ? (
                <Link href={pageHref(sp, pagination.page - 1)}>
                  <ArrowRight className="size-4" /> قبلی
                </Link>
              ) : (
                <span>
                  <ArrowRight className="size-4" /> قبلی
                </span>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              صفحهٔ {faNum(pagination.page)} از {faNum(pagination.total_pages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_next}
              asChild={pagination.has_next}
            >
              {pagination.has_next ? (
                <Link href={pageHref(sp, pagination.page + 1)}>
                  بعدی <ArrowLeft className="size-4" />
                </Link>
              ) : (
                <span>
                  بعدی <ArrowLeft className="size-4" />
                </span>
              )}
            </Button>
          </div>
        ) : null}
      </section>
    </>
  )
}
