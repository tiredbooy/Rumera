import Link from "next/link";
import { ArrowLeft, ChevronLeft, FolderTree } from "lucide-react";

import { StorefrontMedia } from "@/components/storefront-media";
import { CategoryThumbnail } from "@/features/catalog/categories/components/category-thumbnail";
import type { CategoryRouteQuery } from "@/features/catalog/categories/routing";
import type {
  Category,
  CategoryTree,
} from "@/features/catalog/categories/types";
import { getCategoryHref } from "@/features/catalog/categories/utils";
import { faNum } from "@/lib/products";

export function CategoryHero({
  category,
  ancestors,
  parent,
  childCategories,
  totalItems,
  query,
}: {
  category: Category;
  ancestors: CategoryTree[];
  parent?: CategoryTree;
  childCategories: CategoryTree[];
  totalItems: number;
  query: CategoryRouteQuery;
}) {
  const parentHref = parent ? getCategoryHref(parent) : null;
  const monogram = category.title.trim().charAt(0) || "ر";

  return (
    <section className="cellar-glow relative overflow-hidden border-b border-border/60">
      <div className="container-px mx-auto max-w-7xl py-10 sm:py-14 lg:py-20">
        <nav aria-label="مسیر" className="mb-7 text-xs text-muted-foreground">
          <ol className="flex list-none flex-wrap items-center gap-x-1.5 gap-y-2 p-0">
            <BreadcrumbLink href="/">خانه</BreadcrumbLink>
            <BreadcrumbLink href="/categories">دسته‌بندی‌ها</BreadcrumbLink>
            {ancestors.map((ancestor) => {
              const href = getCategoryHref(ancestor);
              return href ? (
                <BreadcrumbLink key={ancestor.id} href={href}>
                  {ancestor.title}
                </BreadcrumbLink>
              ) : (
                <li key={ancestor.id} className="flex items-center gap-1.5">
                  <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
                  <span>{ancestor.title}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-1.5" aria-current="page">
              <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
              <span className="font-medium text-foreground">
                {category.title}
              </span>
            </li>
          </ol>
        </nav>

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)] lg:gap-12">
          <div className="min-w-0">
            <p className="eyebrow mb-4">
              <FolderTree className="size-3.5" aria-hidden /> شاخهٔ مجموعه
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.3] sm:text-5xl lg:text-6xl">
              {category.title}
            </h1>
            {category.description ? (
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                {category.description}
              </p>
            ) : null}

            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              {parent ? (
                <>
                  زیرمجموعهٔ{" "}
                  {parentHref ? (
                    <Link
                      href={parentHref}
                      className="rounded-sm font-medium text-foreground underline decoration-primary/40 underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {parent.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {parent.title}
                    </span>
                  )}
                </>
              ) : (
                "دستهٔ اصلی مجموعه"
              )}
              <span aria-hidden> · </span>
              {childCategories.length
                ? `${faNum(childCategories.length)} زیرشاخهٔ مستقیم برای کاوش`
                : "شاخهٔ پایانی بدون زیرشاخه"}
            </p>

            <p className="mt-4 font-medium text-foreground">
              {query.q
                ? `${faNum(totalItems)} نتیجه برای «${query.q}» در این شاخه و زیرشاخه‌های آن`
                : totalItems > 0
                  ? `${faNum(totalItems)} محصول در این شاخه و زیرشاخه‌های آن`
                  : "هنوز محصولی در این شاخه و زیرشاخه‌های آن منتشر نشده است"}
            </p>
          </div>

          <div className="shadow-e2 relative aspect-[16/10] min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-card ring-1 ring-foreground/5 lg:aspect-[4/3]">
            <StorefrontMedia
              slot="category-hero"
              src={category.image_url}
              alt={`تصویر دسته‌بندی ${category.title}`}
              priority
              monogram={monogram}
              fallbackClassName="from-primary/25 via-card to-secondary"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/35 via-transparent to-transparent"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BreadcrumbLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
      <Link
        href={href}
        className="rounded-sm py-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
      >
        {children}
      </Link>
    </li>
  );
}

export function ChildCategories({
  categories,
  parentTitle,
}: {
  categories: CategoryTree[];
  parentTitle: string;
}) {
  return (
    <section
      id="category-children"
      className="border-b border-border/60 bg-secondary/10"
      aria-labelledby="category-children-title"
    >
      <div className="container-px mx-auto max-w-7xl py-9 sm:py-11">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-2">مسیرهای دقیق‌تر</p>
            <h2
              id="category-children-title"
              className="font-serif text-2xl sm:text-3xl"
            >
              زیرشاخه‌های {parentTitle}
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground">
            نتایج پایین محصولات همهٔ این زیرشاخه‌ها را نیز در بر می‌گیرد.
          </p>
        </div>

        <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <ChildCategoryBranch key={category.id} category={category} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ChildCategoryBranch({ category }: { category: CategoryTree }) {
  const href = getCategoryHref(category);
  const children = category.children ?? [];
  const content = (
    <>
      <CategoryThumbnail category={category} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground [overflow-wrap:anywhere]">
          {category.title}
        </span>
        {category.description ? (
          <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
            {category.description}
          </span>
        ) : null}
      </span>
      {href ? (
        <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">گروه</span>
      )}
    </>
  );

  return (
    <li className="min-w-0">
      {href ? (
        <Link
          href={href}
          className="group/category flex min-h-11 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 outline-none transition-colors hover:border-primary/35 hover:bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-background/50 px-3 py-2">
          {content}
        </div>
      )}

      {!href && children.length ? (
        <ul
          className="ms-4 mt-2 grid list-none gap-2 border-s border-border/70 ps-3"
          aria-label={`زیرشاخه‌های ${category.title}`}
        >
          {children.map((child) => (
            <ChildCategoryBranch key={child.id} category={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
