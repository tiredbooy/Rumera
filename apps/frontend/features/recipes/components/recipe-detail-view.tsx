import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/features/motion/components/reveal";
import {
  getRecipeBySlug,
  listRelatedRecipes,
} from "@/features/recipes/api/server";
import { AddAllIngredientsButton } from "@/features/recipes/components/add-all-button";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { ShoppableProductCard } from "@/features/recipes/components/shoppable-product-card";
import { difficultyFa, formatDuration } from "@/features/recipes/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd } from "@/lib/seo/jsonld";

type RecipeDetailViewProps = {
  params: Promise<{ slug: string }>;
};

export async function RecipeDetailView({ params }: RecipeDetailViewProps) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const related = await listRelatedRecipes(slug);

  const meta = [
    { icon: Clock, label: formatDuration(recipe.total_time_minutes) },
    recipe.servings > 0
      ? { icon: Users, label: `${faNum(recipe.servings)} نفر` }
      : null,
    { icon: Flame, label: difficultyFa[recipe.difficulty] },
    recipe.glass_type ? { icon: Wine, label: recipe.glass_type } : null,
    recipe.calories
      ? { icon: Zap, label: `${faNum(recipe.calories)} کالری` }
      : null,
  ].filter(Boolean) as { icon: typeof Clock; label: string }[];

  const availableCount = recipe.products.filter((p) => p.is_available).length;

  return (
    <>
      <JsonLd
        data={[
          recipe.structured_data ?? {},
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دستورها", path: "/recipes" },
            { name: recipe.title, path: `/recipes/${recipe.slug}` },
          ]),
        ]}
      />

      {/* Hero */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-6xl py-12 sm:py-16">
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            <span className="text-foreground">{recipe.title}</span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <div>
                {recipe.cocktail_type ? (
                  <p className="eyebrow mb-4">{recipe.cocktail_type}</p>
                ) : null}
                <h1 className="text-balance font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
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
                      <m.icon className="size-5 text-primary" />
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
                <SmartImage
                  src={recipe.image_url}
                  alt={recipe.image_alt?.trim() || recipe.title}
                  sizes="(max-width: 1024px) 100vw, 50vw"
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
          <aside
            className="lg:sticky lg:top-24 lg:self-start"
            aria-label="مواد لازم"
            data-recipe-ingredients
          >
            <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5 sm:p-7">
              <p className="eyebrow mb-3">مواد لازم</p>
              <h2 className="font-serif text-2xl">آنچه نیاز دارید</h2>
              {recipe.servings > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  برای {faNum(recipe.servings)} نفر
                </p>
              ) : null}
              <ul className="mt-6 space-y-3.5 text-sm">
                {recipe.ingredients.map((ing) => (
                  <li
                    key={ing.id}
                    className="flex items-start gap-3 border-b border-border/40 pb-3.5 last:border-0 last:pb-0"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="leading-relaxed">
                      <span className="font-medium text-foreground">
                        {ing.ingredient_name}
                      </span>
                      {ing.quantity ? (
                        <span className="text-muted-foreground">
                          {" — "}
                          {ing.quantity}
                          {ing.unit ? ` ${ing.unit}` : ""}
                        </span>
                      ) : null}
                      {ing.optional ? (
                        <span className="ms-1.5 inline-block rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[0.625rem] font-medium text-muted-foreground">
                          اختیاری
                        </span>
                      ) : null}
                      {ing.notes ? (
                        <span className="block text-xs text-muted-foreground/80">
                          {ing.notes}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Instructions */}
          <div data-recipe-instructions>
            <p className="eyebrow mb-3">طرز تهیه</p>
            <h2 className="font-serif text-3xl">گام به گام</h2>
            <div className="mt-6 space-y-4 text-lg leading-8 text-foreground/90 [&_a]:text-primary [&_a]:underline [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-foreground [&_li]:mt-2 [&_li]:ps-1.5 [&_li]:leading-relaxed [&_li]:marker:font-serif [&_li]:marker:text-primary [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:ps-6 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:ps-6 [&_ul]:marker:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {recipe.content}
              </ReactMarkdown>
            </div>

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
            className="mt-20 border-t border-border/60 pt-14"
            data-recipe-shop
          >
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow mb-2">
                  <ShoppingBag className="size-3.5" /> همین دستور را بسازید
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl">
                  محصولات این دستور
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {availableCount > 0
                    ? `${faNum(availableCount)} محصول موجود برای تهیهٔ این دستور`
                    : "هم‌اکنون محصولی برای این دستور موجود نیست"}
                </p>
              </div>
              <AddAllIngredientsButton products={recipe.products} />
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {recipe.products.map((p) => (
                <ShoppableProductCard key={p.recipe_product_id} product={p} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Related */}
      {related.length > 0 ? (
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
            <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {related.slice(0, 3).map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
