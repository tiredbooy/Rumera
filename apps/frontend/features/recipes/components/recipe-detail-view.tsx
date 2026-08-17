import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Flame,
  ShoppingBag,
  Users,
  Wine,
  Zap,
} from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { EditorialContent } from "@/components/editorial-content";
import { StorefrontMedia } from "@/components/storefront-media";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/features/motion/components/reveal";
import {
  getRecipeBySlug,
  listRelatedRecipes,
} from "@/features/recipes/api/server";
import {
  linkIngredientsToCommerce,
  shopSectionId,
} from "@/features/recipes/commerce";
import { AddAllIngredientsButton } from "@/features/recipes/components/add-all-button";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { RecipeIngredientList } from "@/features/recipes/components/recipe-ingredient-list";
import { RecipeMobileShopBar } from "@/features/recipes/components/recipe-mobile-shop-bar";
import { RecipeShopSummary } from "@/features/recipes/components/recipe-shop-summary";
import { RecipeViewTracker } from "@/features/recipes/components/recipe-view-tracker";
import { ShoppableProductCard } from "@/features/recipes/components/shoppable-product-card";
import {
  difficultyFa,
  formatDuration,
} from "@/features/recipes/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd, recipeDetailLd } from "@/lib/seo/jsonld";

type RecipeDetailViewProps = {
  params: Promise<{ slug: string }>;
};

export async function RecipeDetailView({ params }: RecipeDetailViewProps) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const [relatedResult] = await Promise.allSettled([listRelatedRecipes(slug)]);
  const related =
    relatedResult.status === "fulfilled" ? relatedResult.value : [];
  const relatedUnavailable = relatedResult.status === "rejected";

  const meta = [
    {
      icon: Clock,
      term: "زمان کل",
      label: formatDuration(recipe.total_time_minutes),
    },
    recipe.servings > 0
      ? {
          icon: Users,
          term: "تعداد سرو",
          label: `${faNum(recipe.servings)} نفر`,
        }
      : null,
    {
      icon: Flame,
      term: "درجهٔ سختی",
      label: difficultyFa[recipe.difficulty],
    },
    recipe.glass_type
      ? { icon: Wine, term: "ظرف سرو", label: recipe.glass_type }
      : null,
    recipe.calories != null
      ? {
          icon: Zap,
          term: "انرژی هر سرو",
          label: `${faNum(recipe.calories)} کالری`,
        }
      : null,
  ].filter(Boolean) as { icon: typeof Clock; term: string; label: string }[];

  const availableCount = recipe.products.filter((p) => p.is_available).length;
  const commerceIngredients = linkIngredientsToCommerce(
    recipe.ingredients,
    recipe.products,
  );
  const linkedIngredientCount = commerceIngredients.filter(
    (ing) => ing.linked,
  ).length;
  const shopId = shopSectionId();

  const shoppableProductIds = recipe.products.map((p) => p.product_id);

  return (
    <>
      <RecipeViewTracker
        recipeId={recipe.id}
        productIds={shoppableProductIds}
      />
      <JsonLd
        data={[
          recipeDetailLd(recipe),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دستورها", path: "/recipes" },
            {
              name: recipe.title,
              path: `/recipes/${encodeURIComponent(recipe.slug)}`,
            },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="content-header-glow border-b border-border/50">
        <div className="container-px mx-auto max-w-6xl py-10 sm:py-14">
          <nav
            className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            aria-label="مسیر صفحه"
          >
            <Link
              href="/"
              className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              خانه
            </Link>
            <span aria-hidden>/</span>
            <Link
              href="/recipes"
              className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              دستورها
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground" aria-current="page">
              {recipe.title}
            </span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <div>
                {recipe.cocktail_type ? (
                  <p className="eyebrow mb-4">{recipe.cocktail_type}</p>
                ) : null}
                <h1 className="text-balance font-serif text-4xl leading-[1.3] sm:text-5xl lg:text-6xl">
                  {recipe.title}
                </h1>
                {recipe.description || recipe.excerpt ? (
                  <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                    {recipe.description ?? recipe.excerpt}
                  </p>
                ) : null}

                <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                  {meta.map((m) => (
                    <div key={m.label} className="flex items-center gap-2">
                      <m.icon
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <dt className="sr-only">{m.term}</dt>
                      <dd className="text-sm font-medium">{m.label}</dd>
                    </div>
                  ))}
                </dl>

                {recipe.tags.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {recipe.tags.map((t) => (
                      <Badge key={t.id} variant="secondary">
                        {t.title}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              {/* Recipe hero image — recommended 1600×1200 (4:3). */}
              <div className="border-hairline relative aspect-[4/3] overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
                <StorefrontMedia
                  slot="recipe-hero"
                  src={recipe.image_url}
                  alt={recipe.image_alt?.trim() || recipe.title}
                  monogram={recipe.title.charAt(0)}
                  priority
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="container-px mx-auto max-w-6xl py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:gap-14">
          {/* Ingredients */}
          <section
            className="lg:sticky lg:top-24 lg:self-start"
            aria-labelledby="recipe-ingredients-title"
            data-recipe-ingredients
          >
            <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5 sm:p-7">
              <p className="eyebrow mb-3">مواد لازم</p>
              <h2 id="recipe-ingredients-title" className="font-serif text-2xl">
                آنچه نیاز دارید
              </h2>
              <RecipeIngredientList
                ingredients={commerceIngredients}
                servings={recipe.servings}
              />
              <RecipeShopSummary
                linkedCount={linkedIngredientCount}
                availableCount={availableCount}
                totalIngredients={commerceIngredients.length}
                shopHref={
                  recipe.products.length > 0 ? `#${shopId}` : undefined
                }
              />
            </div>
          </section>

          {/* Instructions */}
          <div data-recipe-instructions>
            <p className="eyebrow mb-3">طرز تهیه</p>
            <h2 className="font-serif text-3xl">گام به گام</h2>
            <EditorialContent
              content={recipe.content}
              emptyMessage="مراحل تهیهٔ این دستور هنوز ثبت نشده است."
              className="mt-6"
            />

            {recipe.serving_suggestion ? (
              <div className="border-hairline mt-10 rounded-2xl border-s-2 border-s-primary/50 bg-accent/40 p-6">
                <p className="eyebrow mb-2">پیشنهاد سِرو</p>
                <p className="leading-relaxed text-foreground/90">
                  {recipe.serving_suggestion}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Shop this recipe */}
        {recipe.products.length > 0 ? (
          <div
            id={shopId}
            className="mt-20 scroll-mt-24 border-t border-border/60 pt-14"
            data-recipe-shop
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="eyebrow mb-2">
                  <ShoppingBag className="size-3.5" aria-hidden="true" /> همین
                  دستور را بسازید
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl">
                  محصولات این دستور
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {availableCount > 0
                    ? `${faNum(availableCount)} از ${faNum(recipe.products.length)} محصول موجود — هر مادهٔ لینک‌شده را می‌توانید جداگانه یا یکجا به سبد بیفزایید`
                    : "هم‌اکنون هیچ‌کدام از محصولات این دستور موجود نیست؛ از «یافتن جایگزین» استفاده کنید"}
                </p>
              </div>
              <div className="w-full sm:w-auto">
                <AddAllIngredientsButton products={recipe.products} />
              </div>
            </div>
            <ul className="mt-10 grid list-none gap-5 p-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
              {recipe.products.map((p) => (
                <li key={p.recipe_product_id} className="min-w-0">
                  <ShoppableProductCard product={p} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Mobile sticky shop bar spacer */}
        {recipe.products.length > 0 ? (
          <div aria-hidden className="h-24 lg:hidden" />
        ) : null}
      </section>

      {recipe.products.length > 0 ? (
        <RecipeMobileShopBar products={recipe.products} shopId={shopId} />
      ) : null}

      {/* Related */}
      {related.length > 0 || relatedUnavailable ? (
        <section className="border-t border-border/60 bg-card/30">
          <div className="container-px mx-auto max-w-6xl py-16 sm:py-20">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">برای کاوش بیشتر</p>
                <h2 className="font-serif text-3xl sm:text-4xl">
                  دستورهای مرتبط
                </h2>
              </div>
              <Link
                href="/recipes"
                className="group/all inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                همهٔ دستورها
                <ArrowLeft className="size-4 transition-transform duration-300 group-hover/all:-translate-x-1" />
              </Link>
            </div>
            {related.length > 0 ? (
              <ul className="mt-10 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
                {related.slice(0, 3).map((r) => (
                  <li key={r.id} className="contents">
                    <RecipeCard recipe={r} headingLevel={3} />
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="mt-8 rounded-2xl bg-muted/60 px-5 py-4 text-sm text-muted-foreground"
                role="status"
              >
                دستورهای پیشنهادی موقتاً در دسترس نیستند.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
