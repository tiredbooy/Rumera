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
import { isProductionBuild } from "@/lib/next-phase";
import { CategoryDirectoryCard } from "@/features/catalog/categories/components/category-directory-card";
import type { CategoryTree } from "@/features/catalog/categories/types";
import {
  countRouteableCategories,
  getCategoryHref,
} from "@/features/catalog/categories/utils";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/features/motion/components/reveal";
import { faNum } from "@/lib/products";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/site";

/**
 * Storefront category directory. Presents the full category tree as a browsable
 * grid of premium cards. Each card preserves its complete nested branch while
 * `SmartImage` keeps missing or failed media intentional.
 */
export async function CategoryIndexView() {
  // Prerender must not die because host :8080 is some other process
  // (health 200, Rumera routes 404). Runtime still surfaces the error.
  const tree: CategoryTree[] = await getCategoryTree().catch((error) => {
    if (isProductionBuild()) return [];
    throw error;
  });
  const routeableCategoryCount = countRouteableCategories(tree);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "دسته‌بندی‌ها", path: "/categories" },
          ]),
          categoryCollectionLd(tree),
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
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.3] sm:text-5xl lg:text-6xl">
              از کجا شروع کنیم؟
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              مجموعهٔ رومرا را بر اساس دسته‌بندی مرور کنید — هر دسته دروازه‌ای
              است به برچسب‌های منتخب، از کلاسیک‌های بی‌زمان تا یافته‌های نادر.
            </p>
            {routeableCategoryCount > 0 ? (
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="size-4 text-primary" aria-hidden />
                {`${faNum(routeableCategoryCount)} دستهٔ قابل‌مشاهده برای کاوش`}
              </p>
            ) : null}
          </Reveal>
        </div>
      </section>

      {/* Category grid */}
      <section className="container-px mx-auto max-w-7xl py-12 sm:py-16">
        {tree.length ? (
          <ul className="grid list-none grid-cols-1 items-stretch gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {tree.map((category, i) => (
              <li key={category.id} className="h-full min-w-0">
                <Reveal delay={Math.min(i, 5) * 0.04} y={16} className="h-full">
                  <CategoryDirectoryCard category={category} />
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={PackageOpen}
            title="هنوز دسته‌بندی‌ای برای نمایش نیست"
            description="با اضافه‌شدن دسته‌بندی‌ها، مسیرهای تازهٔ کاوش در این صفحه ظاهر می‌شوند."
          >
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              مشاهدهٔ همهٔ محصولات
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </EmptyState>
        )}
      </section>
    </>
  );
}

function categoryCollectionLd(tree: CategoryTree[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "دسته‌بندی‌های رومرا",
    url: absoluteUrl("/categories"),
    inLanguage: "fa-IR",
    mainEntity: categoryItemListLd(tree, "فهرست دسته‌بندی‌های رومرا"),
  };
}

type CategoryItemListSchema = {
  "@type": "ItemList";
  name: string;
  url?: string;
  itemListElement: CategoryListItemSchema[];
};

type CategoryListItemSchema = {
  "@type": "ListItem";
  position?: number;
  item: CategoryItemListSchema;
};

function categoryItemListLd(
  categories: CategoryTree[],
  name: string,
): CategoryItemListSchema {
  const itemListElement = categories.flatMap((category) => {
    const item = categoryListItemLd(category);
    return item ? [item] : [];
  });

  return {
    "@type": "ItemList",
    name,
    itemListElement: itemListElement.map((item, index) => ({
      ...item,
      position: index + 1,
    })),
  };
}

function categoryListItemLd(
  category: CategoryTree,
): CategoryListItemSchema | null {
  const href = getCategoryHref(category);
  const children = categoryItemListLd(
    category.children ?? [],
    `زیرشاخه‌های ${category.title}`,
  );
  const hasRouteableChildren = children.itemListElement.length > 0;

  if (!href && !hasRouteableChildren) return null;

  return {
    "@type": "ListItem",
    item: {
      ...children,
      name: category.title,
      ...(href ? { url: absoluteUrl(href) } : {}),
    },
  };
}
