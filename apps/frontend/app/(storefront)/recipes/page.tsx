import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  UtensilsCrossed,
  Clock,
  Users,
  Star,
} from "lucide-react";

import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { Reveal } from "@/features/motion/components/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/smart-image";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { RecipeFilters } from "@/features/recipes/components/recipe-filters";
import {
  listRecipes,
  listFeaturedRecipes,
} from "@/features/recipes/api/server";
import {
  difficultyFa,
  formatDuration,
} from "@/features/recipes/utils";
import type {
  RecipeDifficulty,
  RecipeListQuery,
} from "@/features/recipes/types";
import { faNum } from "@/lib/products";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "دستورها و ایده‌ها",
  description:
    "دستورهای کوکتل و ایده‌های میزبانی — قابل جستجو و فیلتر، با محصولات پیشنهادی برای تهیهٔ هر دستور.",
  path: "/recipes",
});

const PAGE_SIZE = 12;

type SearchParams = Promise<{
  q?: string;
  difficulty?: string;
  sort?: string;
  page?: string;
}>;

function toParams(sp: Awaited<SearchParams>): RecipeListQuery {
  const params: RecipeListQuery = { limit: PAGE_SIZE };
  if (sp.q) params.search = sp.q;
  if (
    sp.difficulty === "easy" ||
    sp.difficulty === "medium" ||
    sp.difficulty === "hard"
  ) {
    params.difficulty = sp.difficulty as RecipeDifficulty;
  }
  switch (sp.sort) {
    case "popular":
      params.sortBy = "view_count";
      params.orderBy = "desc";
      break;
    case "quick":
      params.sortBy = "total_time";
      params.orderBy = "asc";
      break;
    default:
      params.sortBy = "published_at";
      params.orderBy = "desc";
  }
  const page = Number(sp.page);
  if (Number.isFinite(page) && page > 1) params.page = page;
  return params;
}

/** Build a /recipes?… href preserving current filters with an overridden page. */
function pageHref(sp: Awaited<SearchParams>, page: number): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.difficulty) params.set("difficulty", sp.difficulty);
  if (sp.sort) params.set("sort", sp.sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/recipes?${qs}` : "/recipes";
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  // The spotlight only shows on the untouched landing view (no filters / page 1).
  const isDefaultView =
    !sp.q && !sp.difficulty && !sp.sort && (!sp.page || sp.page === "1");

  const [{ results: recipes, pagination }, featuredList] = await Promise.all([
    listRecipes(toParams(sp)),
    isDefaultView ? listFeaturedRecipes() : Promise.resolve([]),
  ]);
  const spotlight = featuredList[0];

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "دستورها", path: "/recipes" },
        ])}
      />

      {/* Header */}
      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-4">
              <UtensilsCrossed className="size-3.5" /> دستورها و ایده‌ها
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              چه چیزی میل دارید بسازید؟
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              از کلاسیک‌های بی‌زمان تا ترکیب‌های تازه — جستجو کنید، فیلتر بزنید
              و محصولات لازم را مستقیم از همان صفحه تهیه کنید.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Spotlight (featured) — editorial split card */}
      {spotlight ? (
        <section className="container-px mx-auto max-w-7xl pt-12 sm:pt-16">
          <Reveal>
            <Link
              href={`/recipes/${spotlight.slug}`}
              className="group/spot border-hairline relative grid overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:shadow-2xl hover:shadow-foreground/10 hover:ring-primary/30 sm:rounded-[2rem] lg:grid-cols-2"
            >
              <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto">
                <div className="absolute inset-0 transition-transform duration-[1200ms] ease-out group-hover/spot:scale-[1.05]">
                  <SmartImage
                    src={spotlight.image_url}
                    alt={spotlight.title}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    monogram={spotlight.title.charAt(0)}
                    fallbackClassName="from-primary/20 via-card to-secondary"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-l" />
                <Badge className="absolute start-4 top-4 bg-gold text-gold-foreground shadow-sm">
                  <Star className="size-3 fill-current" /> دستور منتخب
                </Badge>
              </div>
              <div className="flex flex-col justify-center gap-4 p-6 sm:p-10 lg:p-12">
                <p className="eyebrow">برای شروع، این را امتحان کنید</p>
                <h2 className="font-serif text-3xl leading-tight transition-colors group-hover/spot:text-primary sm:text-4xl">
                  {spotlight.title}
                </h2>
                {spotlight.excerpt ? (
                  <p className="line-clamp-3 leading-relaxed text-muted-foreground">
                    {spotlight.excerpt}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" />{" "}
                    {formatDuration(spotlight.total_time_minutes)}
                  </span>
                  {spotlight.servings > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" /> {faNum(spotlight.servings)}{" "}
                      نفر
                    </span>
                  ) : null}
                  <span>{difficultyFa[spotlight.difficulty]}</span>
                </div>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  خواندن دستور کامل
                  <ArrowLeft className="size-4 transition-transform duration-300 group-hover/spot:-translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        </section>
      ) : null}

      <section
        className="container-px mx-auto max-w-7xl py-12 sm:py-16"
        aria-label="فهرست دستورها"
        data-recipes-results
      >
        {/* Sticky filter bar, tucked under the header */}
        <div className="sticky top-[4.25rem] z-30">
          <RecipeFilters />
        </div>

        {/* Result count */}
        <p
          className="mt-6 text-sm text-muted-foreground"
          aria-live="polite"
          role="status"
        >
          {pagination.total_items > 0
            ? `${faNum(pagination.total_items)} دستور یافت شد`
            : "دستوری مطابق فیلترها نیست"}
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
          <ul
            className="mt-6 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3"
            data-recipes-grid
          >
            {recipes.map((recipe, i) => (
              <li key={recipe.id} className="contents">
                <Reveal delay={Math.min(i, 5) * 0.04} y={16}>
                  <RecipeCard recipe={recipe} />
                </Reveal>
              </li>
            ))}
          </ul>
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
  );
}
