import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StorefrontMedia } from "@/components/storefront-media";
import { CategoryThumbnail } from "@/features/catalog/categories/components/category-thumbnail";
import type { CategoryTree } from "@/features/catalog/categories/types";
import {
  countRouteableCategories,
  getCategoryHref,
} from "@/features/catalog/categories/utils";
import { faNum } from "@/lib/products";

export function CategoryDirectoryCard({
  category,
}: {
  category: CategoryTree;
}) {
  const href = getCategoryHref(category);
  const children = category.children ?? [];
  const descendantCount = countRouteableCategories(children);
  const titleId = `category-${category.id}-title`;
  const directoryId = `category-${category.id}-directory`;
  const primaryContent = (
    <>
      <CategoryImage category={category} />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-foil text-xs font-semibold">
          {href ? "دسته‌بندی" : "گروه دسته‌بندی"}
        </p>
        <h2
          id={titleId}
          className="mt-2 text-balance font-serif text-2xl leading-tight [overflow-wrap:anywhere]"
        >
          {category.title}
        </h2>
        {category.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-7 text-muted-foreground">
            {category.description}
          </p>
        ) : null}

        {href ? (
          <span
            aria-hidden="true"
            className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-3 text-sm font-semibold text-primary"
          >
            مشاهدهٔ دسته
            <ArrowLeft className="size-4 transition-transform duration-300 group-hover/category-root:-translate-x-1 motion-reduce:transition-none" />
          </span>
        ) : (
          <p className="mt-auto pt-4 text-xs leading-6 text-muted-foreground">
            مسیرهای زیر را برای ادامهٔ کاوش انتخاب کنید.
          </p>
        )}
      </div>
    </>
  );

  return (
    <article
      aria-labelledby={titleId}
      className="border-hairline shadow-e1 hover:shadow-e3 relative flex h-full min-w-0 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:ring-primary/30 motion-reduce:transform-none motion-reduce:transition-none"
    >
      {href ? (
        <Link
          href={href}
          data-category={category.slug?.trim()}
          className="group/category-root flex min-h-11 flex-1 flex-col outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          {primaryContent}
        </Link>
      ) : (
        <div className="flex flex-1 flex-col">{primaryContent}</div>
      )}

      {children.length ? (
        <section
          aria-labelledby={directoryId}
          className="mt-auto border-t border-border/70 bg-secondary/15 p-4 sm:p-5"
        >
          <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3
              id={directoryId}
              className="font-serif text-base font-semibold text-foreground"
            >
              زیرشاخه‌ها
            </h3>
            {descendantCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {`${faNum(descendantCount)} زیرشاخهٔ قابل‌مشاهده`}
              </p>
            ) : null}
          </div>
          <CategoryBranchList categories={children} depth={1} />
        </section>
      ) : null}
    </article>
  );
}

function CategoryImage({ category }: { category: CategoryTree }) {
  const monogram = category.title.trim().charAt(0) || "ر";

  return (
    <div className="relative aspect-[16/10] overflow-hidden">
      <div className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover/category-root:scale-[1.05] motion-reduce:transition-none">
        <StorefrontMedia
          slot="category-card"
          src={category.image_url}
          alt={`تصویر دسته‌بندی ${category.title}`}
          monogram={monogram}
          fallbackClassName="from-primary/20 via-card to-secondary"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent"
      />
      <span
        aria-hidden="true"
        className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover/category-root:translate-x-full group-hover/category-root:opacity-100 motion-reduce:hidden"
      />
    </div>
  );
}

function CategoryBranchList({
  categories,
  depth,
}: {
  categories: CategoryTree[];
  depth: number;
}) {
  return (
    <ul className="min-w-0 space-y-2">
      {categories.map((category) => (
        <CategoryBranch key={category.id} category={category} depth={depth} />
      ))}
    </ul>
  );
}

function CategoryBranch({
  category,
  depth,
}: {
  category: CategoryTree;
  depth: number;
}) {
  const href = getCategoryHref(category);
  const children = category.children ?? [];
  const content = (
    <>
      <CategoryThumbnail category={category} size="md" />
      <div className="min-w-0 flex-1">
        <CategoryBranchHeading depth={depth} title={category.title} />
        {category.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {category.description}
          </p>
        ) : null}
      </div>
      {href ? (
        <ArrowLeft
          className="size-4 shrink-0 text-primary transition-transform group-hover/category:-translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      ) : (
        <span className="shrink-0 rounded-full border border-border/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
          گروه
        </span>
      )}
    </>
  );

  return (
    <li className="min-w-0">
      {href ? (
        <Link
          href={href}
          data-category={category.slug?.trim()}
          className="group/category flex min-h-11 min-w-0 items-center gap-3 rounded-2xl border border-border/65 bg-card/80 px-3 py-2 text-foreground outline-none transition-[border-color,background-color,box-shadow] hover:border-primary/35 hover:bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-2xl border border-dashed border-border/65 bg-background/35 px-3 py-2">
          {content}
        </div>
      )}

      {children.length ? (
        <div className="mt-2 min-w-0 border-s border-border/70 ps-2 sm:ps-3">
          <CategoryBranchList categories={children} depth={depth + 1} />
        </div>
      ) : null}
    </li>
  );
}

function CategoryBranchHeading({
  depth,
  title,
}: {
  depth: number;
  title: string;
}) {
  const className =
    "text-sm font-semibold leading-6 [overflow-wrap:anywhere] group-hover/category:text-primary";

  if (depth === 1) return <h4 className={className}>{title}</h4>;
  if (depth === 2) return <h5 className={className}>{title}</h5>;
  return <h6 className={className}>{title}</h6>;
}
