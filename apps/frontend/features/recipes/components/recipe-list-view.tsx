import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { ResultsHeading } from "@/components/results-heading";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/features/motion/components/reveal";
import {
  listFeaturedRecipes,
  listRecipes,
} from "@/features/recipes/api/server";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { RecipeFilters } from "@/features/recipes/components/recipe-filters";
import {
  getRecipeSortLabel,
  parseRecipeRouteQuery,
  RECIPE_PAGE_SIZE,
  recipePageHref,
  type RecipeListSearchParams,
} from "@/features/recipes/routing";
import { difficultyFa, formatDuration } from "@/features/recipes/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd, contentListLd } from "@/lib/seo/jsonld";

const RESULTS_ID = "recipe-results-title";

export type { RecipeListSearchParams } from "@/features/recipes/routing";

export async function RecipeListView({
  searchParams,
}: {
  searchParams: RecipeListSearchParams;
}) {
  const query = parseRecipeRouteQuery(await searchParams);
  if (query.needsRedirect) redirect(recipePageHref(query, query.page));

  const isUnfiltered = !query.q && !query.difficulty && query.sort === "new";
  const editorialFeatured = isUnfiltered
    ? (await listFeaturedRecipes().catch(() => []))[0]
    : undefined;
  const { results: recipes, pagination } = await listRecipes({
    page: query.page,
    limit: RECIPE_PAGE_SIZE,
    search: query.q,
    difficulty: query.difficulty,
    sortBy: query.sortBy,
    orderBy: query.orderBy,
    ...(editorialFeatured ? { exclude_id: editorialFeatured.id } : {}),
  });

  const finalPage =
    pagination.total_items === 0 ? 1 : Math.max(1, pagination.total_pages);
  if (query.page > finalPage) redirect(recipePageHref(query, finalPage));

  const spotlight = query.page === 1 ? editorialFeatured : undefined;
  const visibleRecipes = recipes;
  const hasFilters =
    Boolean(query.q) || Boolean(query.difficulty) || query.sort !== "new";
  const resultTitle = query.q
    ? `نتیجهٔ جستجو برای «${query.q}»`
    : query.difficulty
      ? `دستورهای ${difficultyFa[query.difficulty]}`
      : getRecipeSortLabel(query.sort);
  const totalItems =
    pagination.total_items + (editorialFeatured && isUnfiltered ? 1 : 0);
  const status =
    totalItems > 0
      ? `${faNum(totalItems)} دستور، صفحهٔ ${faNum(query.page)} از ${faNum(finalPage)}`
      : hasFilters
        ? "دستوری مطابق فیلترها نیست"
        : "هنوز دستوری منتشر نشده است";
  const structuredItems = [spotlight, ...visibleRecipes]
    .filter((recipe) => recipe !== undefined)
    .map((recipe) => ({
      name: recipe.title,
      path: `/recipes/${encodeURIComponent(recipe.slug)}`,
    }));
  const structuredStart =
    query.page === 1
      ? 1
      : (query.page - 1) * RECIPE_PAGE_SIZE +
        (editorialFeatured ? 2 : 1);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دستورها", path: "/recipes" },
          ]),
          contentListLd(
            resultTitle,
            structuredItems,
            structuredStart,
          ),
        ]}
      />

      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-4">
              <UtensilsCrossed className="size-3.5" aria-hidden="true" />
              دستورها و ایده‌ها
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

      {spotlight ? (
        <section className="container-px mx-auto max-w-7xl pt-12 sm:pt-16">
          <Reveal>
            <Link
              href={`/recipes/${encodeURIComponent(spotlight.slug)}`}
              className="group/spot border-hairline relative grid overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-foreground/5 transition-[box-shadow,border-color] duration-300 hover:shadow-2xl hover:shadow-foreground/10 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 sm:rounded-[2rem] lg:grid-cols-2"
            >
              <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto">
                <div className="absolute inset-0 transition-transform duration-500 ease-cellar group-hover/spot:scale-[1.04]">
                  <SmartImage
                    src={spotlight.image_url}
                    alt={spotlight.image_alt?.trim() || spotlight.title}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    monogram={spotlight.title.charAt(0)}
                    fallbackClassName="from-primary/20 via-card to-secondary"
                    priority
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:bg-gradient-to-l" />
                <Badge className="absolute start-4 top-4 bg-gold text-gold-foreground shadow-sm">
                  <Star className="size-3 fill-current" aria-hidden="true" />
                  دستور منتخب
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
                    <Clock className="size-4" aria-hidden="true" />
                    {formatDuration(spotlight.total_time_minutes)}
                  </span>
                  {spotlight.servings > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" aria-hidden="true" />
                      {faNum(spotlight.servings)} نفر
                    </span>
                  ) : null}
                  <span>{difficultyFa[spotlight.difficulty]}</span>
                </div>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  خواندن دستور کامل
                  <ArrowLeft
                    className="size-4 transition-transform duration-300 group-hover/spot:-translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </Link>
          </Reveal>
        </section>
      ) : null}

      <section
        className="container-px mx-auto max-w-7xl py-12 sm:py-16"
        aria-labelledby={RESULTS_ID}
        data-recipes-results
      >
        <div className="z-30 lg:sticky lg:top-[4.25rem]">
          <RecipeFilters
            key={`${query.q ?? ""}:${query.difficulty ?? ""}:${query.sort}`}
            query={query}
          />
        </div>
        <ResultsHeading
          id={RESULTS_ID}
          eyebrow={getRecipeSortLabel(query.sort)}
          title={resultTitle}
          status={status}
          focusKey={`${query.page}:${query.q ?? ""}:${query.difficulty ?? ""}:${query.sort}:${pagination.total_items}`}
        />

        {visibleRecipes.length === 0 ? (
          spotlight ? (
            <p className="mt-6 rounded-2xl bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
              این تنها دستور منتخب و منتشرشده است.
            </p>
          ) : (
            <div className="border-hairline mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-20 text-center ring-1 ring-foreground/5">
              <UtensilsCrossed
                className="size-10 text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="font-serif text-2xl">
                {hasFilters ? "دستوری پیدا نشد" : "به‌زودی"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasFilters
                  ? "فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید."
                  : "هنوز دستوری منتشر نشده است. به‌زودی سر بزنید."}
              </p>
              {hasFilters ? (
                <Button variant="outline" asChild className="mt-2">
                  <Link href="/recipes">نمایش همهٔ دستورها</Link>
                </Button>
              ) : null}
            </div>
          )
        ) : (
          <ul
            className="mt-6 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3"
            data-recipes-grid
          >
            {visibleRecipes.map((recipe, index) => (
              <li key={recipe.id} className="contents">
                <Reveal delay={Math.min(index, 5) * 0.04} y={16}>
                  <RecipeCard recipe={recipe} headingLevel={3} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}

        {pagination.total_pages > 1 ? (
          <nav
            className="mt-12 flex items-center justify-center gap-3"
            aria-label="صفحه‌بندی دستورها"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_prev}
              asChild={pagination.has_prev}
            >
              {pagination.has_prev ? (
                <Link
                  href={recipePageHref(query, query.page - 1, RESULTS_ID)}
                  rel="prev"
                >
                  <ArrowRight className="size-4" aria-hidden="true" /> قبلی
                </Link>
              ) : (
                <span>
                  <ArrowRight className="size-4" aria-hidden="true" /> قبلی
                </span>
              )}
            </Button>
            <span className="text-sm text-muted-foreground" aria-current="page">
              صفحهٔ {faNum(query.page)} از {faNum(finalPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_next}
              asChild={pagination.has_next}
            >
              {pagination.has_next ? (
                <Link
                  href={recipePageHref(query, query.page + 1, RESULTS_ID)}
                  rel="next"
                >
                  بعدی <ArrowLeft className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  بعدی <ArrowLeft className="size-4" aria-hidden="true" />
                </span>
              )}
            </Button>
          </nav>
        ) : null}
      </section>
    </>
  );
}
