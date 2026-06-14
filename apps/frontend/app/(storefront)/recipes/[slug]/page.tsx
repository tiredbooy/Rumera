import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Clock,
  Users,
  Flame,
  Zap,
  Wine,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { SmartImage } from "@/components/smart-image"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion/reveal"
import { RecipeCard } from "@/components/recipes/recipe-card"
import { AddToCartButton } from "@/components/catalog/add-to-cart-button"
import { faNum, formatPrice } from "@/lib/products"
import {
  getRecipeBySlug,
  getRelatedRecipes,
  allRecipeSlugs,
  difficultyFa,
  formatDuration,
  type ShoppableProduct,
} from "@/lib/recipes"

export const revalidate = 3600

export async function generateStaticParams() {
  const slugs = await allRecipeSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const recipe = await getRecipeBySlug(slug)
  if (!recipe) return buildMetadata({ title: "دستور یافت نشد", index: false })
  return buildMetadata({
    title: recipe.meta_title ?? recipe.title,
    description: recipe.meta_description ?? recipe.excerpt ?? recipe.description ?? undefined,
    path: `/recipes/${recipe.slug}`,
    type: "article",
    images: [recipe.og_image_url ?? recipe.image_url].filter(Boolean) as string[],
  })
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const recipe = await getRecipeBySlug(slug)
  if (!recipe) notFound()

  const related = await getRelatedRecipes(slug)

  const meta = [
    { icon: Clock, label: formatDuration(recipe.total_time_minutes) },
    recipe.servings > 0 ? { icon: Users, label: `${faNum(recipe.servings)} نفر` } : null,
    { icon: Flame, label: difficultyFa[recipe.difficulty] },
    recipe.glass_type ? { icon: Wine, label: recipe.glass_type } : null,
    recipe.calories ? { icon: Zap, label: `${faNum(recipe.calories)} کالری` } : null,
  ].filter(Boolean) as { icon: typeof Clock; label: string }[]

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
      <section className="border-b border-border/60">
        <div className="container-px mx-auto max-w-6xl py-10">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">خانه</Link>
            <span>/</span>
            <Link href="/recipes" className="hover:text-foreground">دستورها</Link>
            <span>/</span>
            <span className="text-foreground">{recipe.title}</span>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <div>
                {recipe.cocktail_type ? (
                  <p className="eyebrow mb-3">{recipe.cocktail_type}</p>
                ) : null}
                <h1 className="font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
                  {recipe.title}
                </h1>
                {recipe.description || recipe.excerpt ? (
                  <p className="mt-5 text-lg text-muted-foreground">
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
      <section className="container-px mx-auto max-w-6xl py-14">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr]">
          {/* Ingredients */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border-hairline rounded-3xl bg-card p-6 ring-1 ring-foreground/5">
              <h2 className="font-serif text-2xl">مواد لازم</h2>
              {recipe.servings > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  برای {faNum(recipe.servings)} نفر
                </p>
              ) : null}
              <ul className="mt-5 space-y-3 text-sm">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} className="flex items-start gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      <span className="font-medium">{ing.ingredient_name}</span>
                      {ing.quantity ? (
                        <span className="text-muted-foreground">
                          {" — "}
                          {ing.quantity}
                          {ing.unit ? ` ${ing.unit}` : ""}
                        </span>
                      ) : null}
                      {ing.optional ? (
                        <span className="text-muted-foreground"> (اختیاری)</span>
                      ) : null}
                      {ing.notes ? (
                        <span className="block text-xs text-muted-foreground/80">{ing.notes}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Instructions */}
          <div>
            <h2 className="font-serif text-2xl">طرز تهیه</h2>
            <div className="mt-5 space-y-4 leading-8 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-foreground [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:ps-6 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:ps-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {recipe.content}
              </ReactMarkdown>
            </div>

            {recipe.serving_suggestion ? (
              <div className="border-hairline mt-8 rounded-2xl bg-accent/40 p-5">
                <p className="text-sm font-semibold text-foreground">پیشنهاد سِرو</p>
                <p className="mt-1 text-sm text-muted-foreground">{recipe.serving_suggestion}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Shop this recipe */}
        {recipe.products.length > 0 ? (
          <div className="mt-16">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">
                  <ShoppingBag className="size-3.5" /> همین دستور را بسازید
                </p>
                <h2 className="font-serif text-3xl">محصولات این دستور</h2>
              </div>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="container-px mx-auto max-w-6xl py-14">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-3xl">دستورهای مرتبط</h2>
              <Link
                href="/recipes"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary"
              >
                همهٔ دستورها <ArrowLeft className="size-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.slice(0, 3).map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}

function ShoppableCard({ product }: { product: ShoppableProduct }) {
  const pdp = product.product_slug ? `/products/${product.product_slug}` : null
  const onSale =
    product.compare_at_price != null && product.compare_at_price > product.price

  const Image = (
    <div className="relative aspect-square overflow-hidden rounded-2xl">
      <SmartImage
        src={product.image_url}
        alt={product.product_title}
        sizes="(max-width: 640px) 100vw, 33vw"
        monogram={product.product_title.charAt(0)}
      />
    </div>
  )

  return (
    <article className="border-hairline flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5">
      {pdp ? <Link href={pdp}>{Image}</Link> : Image}

      <div className="flex flex-1 flex-col">
        {product.role ? (
          <span className="text-xs font-medium text-primary">{product.role}</span>
        ) : product.is_primary ? (
          <span className="text-xs font-medium text-primary">پایهٔ اصلی</span>
        ) : null}

        <h3 className="mt-1 font-serif text-lg leading-tight">
          {pdp ? <Link href={pdp}>{product.product_title}</Link> : product.product_title}
        </h3>
        {product.brand ? (
          <p className="text-xs text-muted-foreground">{product.brand}</p>
        ) : null}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-xl">{formatPrice(product.price)}</span>
          {onSale ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          {product.is_available ? (
            <AddToCartButton productVariantId={product.product_variant_id} />
          ) : (
            <p className="text-sm font-medium text-muted-foreground">ناموجود</p>
          )}
        </div>
      </div>
    </article>
  )
}
