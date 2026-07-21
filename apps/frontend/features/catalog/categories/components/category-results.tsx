import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  PackageOpen,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryResultsHeading } from "@/features/catalog/categories/components/category-results-heading";
import {
  CATEGORY_SEARCH_MAX_LENGTH,
  CATEGORY_SORT_OPTIONS,
  categoryPageHref,
  getCategorySortLabel,
  type CategoryRouteQuery,
} from "@/features/catalog/categories/routing";
import { ProductCard } from "@/features/catalog/products/components/product-card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import type { Pagination } from "@/lib/api/types";
import { faNum } from "@/lib/products";

const CATEGORY_RESULTS_ID = "category-products-title";
const CATEGORY_RESULTS_HASH = `#${CATEGORY_RESULTS_ID}`;

function withCategoryResultsHash(href: string): string {
  return `${href}${CATEGORY_RESULTS_HASH}`;
}

export function CategoryResults({
  basePath,
  categoryTitle,
  query,
  pagination,
  products,
  hasChildren,
}: {
  basePath: string;
  categoryTitle: string;
  query: CategoryRouteQuery;
  pagination: Pagination;
  products: ProductListItem[];
  hasChildren: boolean;
}) {
  const activeQuery = Boolean(query.q) || query.sort !== "newest";

  return (
    <section
      className="container-px mx-auto max-w-7xl py-10 sm:py-14 lg:py-16"
      aria-labelledby={CATEGORY_RESULTS_ID}
    >
      <CategoryToolbar
        basePath={basePath}
        query={query}
        activeQuery={activeQuery}
      />

      <ResultHeading
        categoryTitle={categoryTitle}
        query={query}
        pagination={pagination}
        visibleCount={products.length}
      />

      {products.length ? (
        <ul
          id="category-products-grid"
          className="mt-7 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {products.map((product) => (
            <li key={product.id} className="h-full min-w-0">
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      ) : (
        <CategoryEmptyState
          basePath={basePath}
          query={query}
          hasChildren={hasChildren}
        />
      )}

      <CategoryPagination
        pagination={pagination}
        basePath={basePath}
        query={query}
      />
    </section>
  );
}

function CategoryToolbar({
  basePath,
  query,
  activeQuery,
}: {
  basePath: string;
  query: CategoryRouteQuery;
  activeQuery: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm sm:p-5">
      <form
        action={withCategoryResultsHash(basePath)}
        method="get"
        role="search"
        aria-label="جست‌وجو و مرتب‌سازی محصولات این دسته"
        className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.42fr)_auto] md:items-end"
      >
        <div className="min-w-0">
          <label
            htmlFor="category-product-search"
            className="mb-2 block text-sm font-semibold text-foreground"
          >
            جست‌وجو در این شاخه
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="category-product-search"
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              maxLength={CATEGORY_SEARCH_MAX_LENGTH}
              placeholder="نام محصول را بنویسید"
              className="min-h-11 w-full rounded-2xl border border-border bg-background ps-10 pe-3 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="category-product-sort"
            className="mb-2 block text-sm font-semibold text-foreground"
          >
            مرتب‌سازی
          </label>
          <div className="relative">
            <SlidersHorizontal
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <select
              id="category-product-sort"
              name="sort"
              defaultValue={query.sort}
              className="min-h-11 w-full cursor-pointer appearance-none rounded-2xl border border-border bg-background ps-10 pe-9 text-base outline-none transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20"
            >
              {CATEGORY_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronLeft
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 -rotate-90 text-muted-foreground"
              aria-hidden
            />
          </div>
        </div>

        <Button type="submit" className="min-h-11 w-full px-5 md:w-auto">
          نمایش نتایج
        </Button>
      </form>

      {activeQuery ? (
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm">
          <p className="min-w-0 leading-7 text-muted-foreground">
            فیلتر فعال:
            {query.q ? (
              <span className="ms-1 font-medium text-foreground">
                جست‌وجوی «{query.q}»
              </span>
            ) : null}
            {query.q && query.sort !== "newest" ? "، " : " "}
            {query.sort !== "newest" ? (
              <span className="font-medium text-foreground">
                مرتب‌سازی {getCategorySortLabel(query.sort)}
              </span>
            ) : null}
          </p>
          <Link
            href={withCategoryResultsHash(basePath)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 font-semibold text-primary outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-4" aria-hidden /> پاک کردن
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ResultHeading({
  categoryTitle,
  query,
  pagination,
  visibleCount,
}: {
  categoryTitle: string;
  query: CategoryRouteQuery;
  pagination: Pagination;
  visibleCount: number;
}) {
  const first =
    pagination.total_items > 0
      ? (pagination.page - 1) * pagination.limit + 1
      : 0;
  const last = Math.min(
    pagination.total_items,
    first + Math.max(visibleCount - 1, 0),
  );

  const title = query.q
    ? `نتایج جست‌وجو در ${categoryTitle}`
    : `محصولات ${categoryTitle}`;
  const status =
    pagination.total_items > 0
      ? `نمایش ${faNum(first)} تا ${faNum(last)} از ${faNum(pagination.total_items)} محصول در این شاخه و زیرشاخه‌های آن`
      : query.q
        ? `برای «${query.q}» نتیجه‌ای در این شاخه و زیرشاخه‌های آن پیدا نشد`
        : "محصولی در این شاخه و زیرشاخه‌های آن منتشر نشده است";

  return (
    <div className="mt-9 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-4">
      <CategoryResultsHeading
        id={CATEGORY_RESULTS_ID}
        title={title}
        status={status}
        focusKey={`${query.page}:${query.sort}:${query.q ?? ""}:${pagination.total_items}`}
      />
    </div>
  );
}

function CategoryEmptyState({
  basePath,
  query,
  hasChildren,
}: {
  basePath: string;
  query: CategoryRouteQuery;
  hasChildren: boolean;
}) {
  const filtered = Boolean(query.q);

  return (
    <div className="mt-7">
      <Placeholder
        icon={PackageOpen}
        title={
          filtered
            ? `برای «${query.q}» محصولی پیدا نشد`
            : "هنوز محصولی در این شاخه نیست"
        }
        description={
          filtered
            ? "عبارت دیگری را امتحان کنید یا جست‌وجو را پاک کنید تا همهٔ محصولات این شاخه و زیرشاخه‌های آن دیده شوند."
            : "این دسته و زیرشاخه‌های آن هنوز محصول منتشرشده‌ای ندارند. می‌توانید مسیر دیگری را کاوش کنید یا همهٔ محصولات را ببینید."
        }
      >
        <div className="flex flex-wrap justify-center gap-2">
          {filtered ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={withCategoryResultsHash(basePath)}>
                پاک کردن جست‌وجو
              </Link>
            </Button>
          ) : null}
          {hasChildren ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="#category-children">کاوش زیرشاخه‌ها</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/categories">دسته‌بندی‌های دیگر</Link>
            </Button>
          )}
          <Button asChild className="min-h-11">
            <Link href="/products">همهٔ محصولات</Link>
          </Button>
        </div>
      </Placeholder>
    </div>
  );
}

function CategoryPagination({
  pagination,
  basePath,
  query,
}: {
  pagination: Pagination;
  basePath: string;
  query: CategoryRouteQuery;
}) {
  if (pagination.total_pages <= 1) return null;

  return (
    <nav
      aria-label="صفحه‌بندی محصولات دسته‌بندی"
      className="mt-12 flex flex-wrap items-center justify-center gap-3"
    >
      <Button
        variant="outline"
        disabled={!pagination.has_prev}
        asChild={pagination.has_prev}
        className="min-h-11 px-4"
      >
        {pagination.has_prev ? (
          <Link
            href={withCategoryResultsHash(
              categoryPageHref(basePath, query, pagination.page - 1),
            )}
            rel="prev"
          >
            قبلی
          </Link>
        ) : (
          <span>قبلی</span>
        )}
      </Button>

      <span
        className="min-w-28 text-center text-sm text-muted-foreground"
        aria-current="page"
      >
        صفحهٔ {faNum(pagination.page)} از {faNum(pagination.total_pages)}
      </span>

      <Button
        variant="outline"
        disabled={!pagination.has_next}
        asChild={pagination.has_next}
        className="min-h-11 px-4"
      >
        {pagination.has_next ? (
          <Link
            href={withCategoryResultsHash(
              categoryPageHref(basePath, query, pagination.page + 1),
            )}
            rel="next"
          >
            بعدی <ArrowLeft className="size-4" aria-hidden />
          </Link>
        ) : (
          <span>بعدی</span>
        )}
      </Button>
    </nav>
  );
}
