import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ChevronLeft, Grid2x2, Layers, PackageOpen } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { absoluteUrl } from "@/lib/site"
import { categoryTree } from "@/lib/catalog/categories"
import type { Category } from "@/lib/catalog/types"
import { faNum } from "@/lib/products"
import { Reveal } from "@/components/motion/reveal"
import { SmartImage } from "@/components/smart-image"
import { Placeholder } from "@/components/dashboard/placeholder"

export const revalidate = 3600

export const metadata: Metadata = buildMetadata({
  title: "دسته‌بندی‌ها",
  description:
    "فهرست کامل دسته‌بندی‌های رومرا — از ویسکی و شراب تا شامپاین و اسپیریت‌های نایاب. دسته‌ای را برگزینید و مجموعهٔ منتخب آن را مرور کنید.",
  path: "/categories",
})

/**
 * Storefront category directory. Presents the full category tree as a browsable
 * grid of premium cards. The public `/categories/tree` payload carries no
 * imagery or product counts, so cards lean on `SmartImage`'s on-brand monogram
 * fallback and surface child categories as quick-jump chips instead.
 */
export default async function CategoriesPage() {
  const tree = await categoryTree()
  const roots = tree.filter((c) => Boolean(c.slug))
  const totalChildren = roots.reduce((sum, c) => sum + (c.children?.length ?? 0), 0)

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دسته‌بندی‌ها", path: "/categories" },
          ]),
          categoryListLd(roots),
        ]}
      />

      {/* Header — editorial cellar masthead, consistent with other landings. */}
      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-14 sm:py-20 lg:py-24">
          <nav
            aria-label="مسیر"
            className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              خانه
            </Link>
            <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
            <span className="font-medium text-foreground">دسته‌بندی‌ها</span>
          </nav>

          <Reveal>
            <p className="eyebrow mb-4">
              <Grid2x2 className="size-3.5" aria-hidden /> راهنمای انبار
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              از کجا شروع کنیم؟
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              مجموعهٔ رومرا را بر اساس دسته‌بندی مرور کنید — هر دسته دروازه‌ای است
              به برچسب‌های منتخب، از کلاسیک‌های بی‌زمان تا یافته‌های نادر.
            </p>
            {roots.length ? (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="size-4 text-primary" aria-hidden />
                {`${faNum(roots.length)} دستهٔ اصلی`}
                {totalChildren > 0 ? ` · ${faNum(totalChildren)} زیرشاخه` : null}
              </p>
            ) : null}
          </Reveal>
        </div>
      </section>

      {/* Category grid */}
      <section className="container-px mx-auto max-w-7xl py-12 sm:py-16">
        {roots.length ? (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {roots.map((category, i) => (
              <li key={category.id}>
                <Reveal delay={Math.min(i, 5) * 0.04} y={16}>
                  <CategoryCard category={category} />
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder
            icon={PackageOpen}
            title="هنوز دسته‌بندی‌ای ثبت نشده است"
            description="به‌زودی دسته‌بندی‌ها در این صفحه نمایش داده می‌شوند. اگر سرویس در دسترس نیست، کمی بعد دوباره سر بزنید."
          >
            <Link
              href="/products"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              مشاهدهٔ همهٔ محصولات
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Placeholder>
        )}
      </section>
    </>
  )
}

/**
 * A single category card. The image stage uses `SmartImage` so a missing asset
 * degrades to the warm monogram fallback rather than a broken image. Child
 * categories appear as keyboard-reachable chips that link straight to their own
 * landing without leaving the parent's card link in the way.
 */
function CategoryCard({ category }: { category: Category }) {
  const href = `/categories/${category.slug}`
  const children = (category.children ?? []).filter((c) => Boolean(c.slug))
  const visibleChildren = children.slice(0, 4)
  const extraChildren = children.length - visibleChildren.length

  return (
    <article className="group/cat border-hairline press shadow-e1 hover:shadow-e3 relative flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:ring-primary/30">
      {/* Image stage — the whole card surface links to the category page. The
          link stretches via the ::after overlay so child chips can sit above it. */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover/cat:scale-[1.05]">
          <SmartImage
            src={null}
            alt={category.name}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            monogram={category.name.charAt(0)}
            fallbackClassName="from-primary/20 via-card to-secondary"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent"
        />
        {/* Sheen sweep on hover — premium catch-light across the stage. */}
        <span
          aria-hidden
          className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover/cat:translate-x-full group-hover/cat:opacity-100 motion-reduce:hidden"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <h2 className="font-serif text-2xl leading-tight">
          <Link
            href={href}
            className="outline-none transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            data-category={category.slug}
          >
            {category.name}
          </Link>
        </h2>

        {category.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {category.description}
          </p>
        ) : null}

        {visibleChildren.length ? (
          <ul className="relative z-10 mt-1 flex flex-wrap gap-1.5">
            {visibleChildren.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/categories/${child.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {child.name}
                </Link>
              </li>
            ))}
            {extraChildren > 0 ? (
              <li>
                <span className="inline-flex min-h-9 items-center rounded-full border border-dashed border-border/70 px-3 py-1 text-xs text-muted-foreground">
                  {`+${faNum(extraChildren)} زیرشاخه`}
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {/* CTA — purely decorative affordance; the card title carries the link. */}
        <span
          aria-hidden
          className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary"
        >
          مشاهدهٔ دسته
          <ArrowLeft className="size-4 transition-transform duration-300 group-hover/cat:-translate-x-1" />
        </span>
      </div>
    </article>
  )
}

/** Inline `ItemList` schema for the category directory (the tree carries no
 * Product nodes, so `itemListLd` from the SEO lib doesn't fit here). */
function categoryListLd(roots: Category[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "دسته‌بندی‌های رومرا",
    itemListElement: roots.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: absoluteUrl(`/categories/${c.slug}`),
    })),
  }
}
