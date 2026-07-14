import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  Grid2x2,
  Layers,
  PackageOpen,
} from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { getCategoryTree } from "@/features/catalog/categories/api";
import { CategoryDirectoryCard } from "@/features/catalog/categories/components/category-directory-card";
import type { CategoryTree } from "@/features/catalog/categories/types";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { Reveal } from "@/features/motion/components/reveal";
import { faNum } from "@/lib/products";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/site";

/**
 * Storefront category directory. Presents the full category tree as a browsable
 * grid of premium cards. Cards use `SmartImage`'s on-brand monogram fallback and
 * surface child categories as quick-jump chips.
 */
export async function CategoryIndexView() {
  const tree: CategoryTree[] = await getCategoryTree();
  const roots = tree.filter((c) => Boolean(c.slug));
  const totalChildren = roots.reduce(
    (sum, c) => sum + (c.children?.length ?? 0),
    0,
  );

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
              مجموعهٔ رومرا را بر اساس دسته‌بندی مرور کنید — هر دسته دروازه‌ای
              است به برچسب‌های منتخب، از کلاسیک‌های بی‌زمان تا یافته‌های نادر.
            </p>
            {roots.length ? (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="size-4 text-primary" aria-hidden />
                {`${faNum(roots.length)} دستهٔ اصلی`}
                {totalChildren > 0
                  ? ` · ${faNum(totalChildren)} زیرشاخه`
                  : null}
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
                  <CategoryDirectoryCard category={category} />
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
  );
}

/** Inline `ItemList` schema for the category directory (the tree carries no
 * Product nodes, so `itemListLd` from the SEO lib doesn't fit here). */
function categoryListLd(roots: CategoryTree[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "دسته‌بندی‌های رومرا",
    itemListElement: roots.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.title,
      url: absoluteUrl(`/categories/${c.slug}`),
    })),
  };
}
