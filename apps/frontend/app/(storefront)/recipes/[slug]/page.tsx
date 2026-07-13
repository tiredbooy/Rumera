import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Clock,
  Users,
  Flame,
  Zap,
  Wine,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";

import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/features/motion/components/reveal";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { AddToCartButton } from "@/features/catalog/products/components/add-to-cart-button";
import { AddAllIngredientsButton } from "@/features/recipes/components/add-all-button";
import { faNum, formatPrice } from "@/lib/products";
import {
  getRecipeBySlug,
  listRecipeSlugs,
  listRelatedRecipes,
} from "@/features/recipes/api/server";
import {
  difficultyFa,
  formatDuration,
} from "@/features/recipes/utils";
import type { ShoppableProduct } from "@/features/recipes/types";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await listRecipeSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) return buildMetadata({ title: "دستور یافت نشد", index: false });
  return buildMetadata({
    title: recipe.meta_title ?? recipe.title,
    description:
      recipe.meta_description ??
      recipe.excerpt ??
      recipe.description ??
      undefined,
    path: `/recipes/${recipe.slug}`,
    type: "article",
    images: [recipe.og_image_url ?? recipe.image_url].filter(
      Boolean,
    ) as string[],
  });
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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
                  src={recipe.og_image_url ?? recipe.image_url}
                  alt={recipe.title}
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
                <ShoppableCard key={p.recipe_product_id} product={p} />
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

function ShoppableCard({ product }: { product: ShoppableProduct }) {
  const pdp = product.product_slug ? `/products/${product.product_slug}` : null;
  const onSale =
    product.compare_at_price != null &&
    product.compare_at_price > product.price;

  const Image = (
    <div className="relative aspect-square overflow-hidden rounded-2xl">
      <SmartImage
        src={product.image_url}
        alt={product.product_title}
        sizes="(max-width: 640px) 100vw, 33vw"
        monogram={product.product_title.charAt(0)}
      />
    </div>
  );

  // How much of this product the recipe calls for, e.g. «۶۰ میلی‌لیتر».
  const measure = [product.quantity, product.unit]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <article
      className="border-hairline shadow-e1 flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5 transition-shadow duration-300 hover:shadow-e3"
      data-shoppable-product={product.product_variant_id}
    >
      {pdp ? (
        <Link
          href={pdp}
          aria-label={product.product_title}
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {Image}
        </Link>
      ) : (
        Image
      )}

      <div className="flex flex-1 flex-col">
        {product.role ? (
          <span className="text-xs font-medium text-primary">
            {product.role}
          </span>
        ) : product.is_primary ? (
          <span className="text-xs font-medium text-primary">پایهٔ اصلی</span>
        ) : null}

        <h3 className="mt-1 font-serif text-lg leading-tight">
          {pdp ? (
            <Link
              href={pdp}
              className="rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {product.product_title}
            </Link>
          ) : (
            product.product_title
          )}
        </h3>
        {product.brand ? (
          <p className="text-xs text-muted-foreground">{product.brand}</p>
        ) : null}

        {measure ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            برای این دستور:{" "}
            <span className="font-medium text-foreground/80">{measure}</span>
          </p>
        ) : null}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-xl">
            {formatPrice(product.price)}
          </span>
          {onSale ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          {product.is_available ? (
            <AddToCartButton
              productVariantId={product.product_variant_id}
              className="w-full"
            />
          ) : (
            <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-center text-sm font-medium text-muted-foreground">
              ناموجود
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
