import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Star,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { JsonLd } from "@/components/json-ld";
import { ListPagination } from "@/components/list-pagination";
import { ResultsHeading } from "@/components/results-heading";
import { StorefrontMedia } from "@/components/storefront-media";
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
  recipeRedirectHref,
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
  if (query.needsRedirect) redirect(recipeRedirectHref(query, query.page));

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

      <section className="content-header-glow relative overflow-hidden border-b border-border/50">
        <div className="container-px mx-auto max-w-7xl py-14 sm:py-16 lg:py-20">
          <Reveal>
            <p className="eyebrow mb-4">
              <UtensilsCrossed className="size-3.5" aria-hidden="true" />
              دستورها و ایده‌ها
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.3] sm:text-5xl lg:text-6xl">
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
              className="group/spot relative grid overflow-hidden rounded-[1.5rem] bg-card shadow-e1 ring-1 ring-primary/15 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-e2 hover:ring-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 sm:rounded-[1.75rem] lg:grid-cols-2"
              data-recipe-card="featured"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-0 z-20 w-1 bg-gradient-to-b from-gold via-primary to-gold/70 lg:w-1.5"
              />
              <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[18rem]">
                <div className="absolute inset-0 transition-transform duration-500 ease-cellar group-hover/spot:scale-[1.03]">
                  <StorefrontMedia
                    slot="recipe-hero"
                    src={spotlight.image_url}
                    alt={spotlight.image_alt?.trim() || spotlight.title}
                    monogram={spotlight.title.charAt(0)}
                    fallbackClassName="from-primary/20 via-card to-secondary"
                    priority
                  />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/45 via-transparent to-transparent lg:bg-gradient-to-l lg:from-background/50"
                />
                <span className="absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-background/90 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm sm:start-4 sm:top-4">
                  <Star
                    className="size-3.5 fill-primary/25"
                    aria-hidden="true"
                  />
                  دستور منتخب
                </span>
              </div>
              <div className="relative flex flex-col justify-center gap-4 border-t border-border/40 p-6 sm:p-9 lg:border-s lg:border-t-0 lg:p-10 lg:ps-11">
                <p className="text-sm font-medium text-muted-foreground">
                  برای شروع، این را امتحان کنید
                </p>
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
            <EmptyState
              icon={UtensilsCrossed}
              title={hasFilters ? "دستوری پیدا نشد" : "به‌زودی"}
              description={
                hasFilters
                  ? "فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید."
                  : "هنوز دستوری منتشر نشده است. به‌زودی سر بزنید."
              }
              className="mt-6"
            >
              {hasFilters ? (
                <Button variant="outline" asChild>
                  <Link href="/recipes">نمایش همهٔ دستورها</Link>
                </Button>
              ) : null}
            </EmptyState>
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

        <ListPagination
          page={query.page}
          totalPages={finalPage}
          hasPrev={pagination.has_prev}
          hasNext={pagination.has_next}
          prevHref={recipePageHref(query, query.page - 1, RESULTS_ID)}
          nextHref={recipePageHref(query, query.page + 1, RESULTS_ID)}
          ariaLabel="صفحه‌بندی دستورها"
          className="mt-12"
        />
      </section>
    </>
  );
}
