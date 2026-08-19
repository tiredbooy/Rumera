import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageOpen } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { ListPagination } from "@/components/list-pagination";
import { RouteLoadingRegion } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBrand,
  getBrandBySlug,
  listBrands,
} from "@/features/catalog/brands/api";
import { listCategories } from "@/features/catalog/categories/api";
import { listProducts } from "@/features/catalog/products/api/public";
import {
  ProductCard,
  PRODUCT_CARD_GRID_CLASS,
} from "@/features/catalog/products/components/product-card";
import { CatalogueLoadError } from "@/features/catalog/products/components/catalogue-load-error";
import { ProductGridSkeleton } from "@/features/catalog/products/components/product-grid-skeleton";
import { ProductSearch } from "@/features/catalog/products/components/product-search";
import { ProductSort } from "@/features/catalog/products/components/product-sort";
import {
  parseProductListRouteQuery,
  productListBrandHref,
  productListHref,
  productListRedirectHref,
  PRODUCT_LIST_PAGE_SIZE,
  type ProductListRouteQuery,
  type ProductListSearchParamsRecord,
} from "@/features/catalog/products/list-routing";
import type { ProductListItem } from "@/features/catalog/products/types";
import { EmptyState } from "@/components/empty-state";
import type { Paginated } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

type ProductListViewProps = {
  searchParams: Promise<ProductListSearchParamsRecord>;
};

/**
 * The catalogue request, already settled into ok/failed so a rejection can
 * never escape as an unhandled promise while the shell is still deciding
 * whether to redirect.
 */
type SettledProductPage =
  | { ok: true; page: Paginated<ProductListItem> }
  | { ok: false };

const FILTER_CHIP_CLASS =
  "inline-flex min-h-8 items-center rounded-full border px-4 py-1.5 text-sm [@media(any-pointer:coarse)]:min-h-11";

export async function ProductListView({ searchParams }: ProductListViewProps) {
  const raw = await searchParams;
  const query = parseProductListRouteQuery(raw);

  if (query.legacyBrandId && !query.brand) {
    const legacyBrand = await getBrand(query.legacyBrandId).catch(() => null);
    redirect(
      productListRedirectHref(
        {
          search: query.search,
          brand: legacyBrand?.slug,
          sortBy: query.sortBy,
          orderBy: query.orderBy,
          passthrough: query.passthrough,
        },
        query.page,
      ),
    );
  }

  if (query.needsRedirect) {
    redirect(productListRedirectHref(query, query.page));
  }

  /**
   * Fired before the shell's own lookups are awaited, so the catalogue query
   * stays concurrent with the brand/category chrome exactly as it was when all
   * four shared one `Promise.all`. Only the *awaiting* moved into the boundary.
   */
  const productsPromise: Promise<SettledProductPage> = listProducts({
    page: query.page,
    limit: PRODUCT_LIST_PAGE_SIZE,
    search: query.search,
    brand: query.brand,
    sortBy: query.sortBy,
    orderBy: query.orderBy,
  })
    .then((page) => ({ ok: true as const, page }))
    .catch(() => ({ ok: false as const }));

  const [categories, brandsPage, selectedBrand] = await Promise.all([
    listCategories(),
    listBrands({ limit: 24, sortBy: "title", orderBy: "asc" }).catch(() => ({
      results: [] as Awaited<ReturnType<typeof listBrands>>["results"],
      pagination: {
        page: 1,
        limit: 24,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      },
    })),
    query.brand
      ? getBrandBySlug(query.brand).catch(() => null)
      : Promise.resolve(null),
  ]);
  const brands = brandsPage.results ?? [];
  const activeBrand =
    selectedBrand ?? brands.find((brand) => brand.slug === query.brand);

  // Every redirect resolves here, before a single byte of the shell is flushed —
  // a redirect thrown from inside a boundary would land on a half-sent page.
  if (query.brand && !activeBrand) {
    redirect(
      productListRedirectHref(
        {
          search: query.search,
          sortBy: query.sortBy,
          orderBy: query.orderBy,
          passthrough: query.passthrough,
        },
        1,
      ),
    );
  }

  const allProductsHref = productListHref(
    {
      search: query.search,
      sortBy: query.sortBy,
      orderBy: query.orderBy,
    },
    1,
  );

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "فروشگاه", path: "/products" },
        ])}
      />

      <section className="container-px mx-auto w-full max-w-7xl py-14">
        <p className="eyebrow mb-3">کاتالوگ کامل</p>
        <h1 className="font-serif text-5xl">
          {activeBrand ? activeBrand.title : "فروشگاه بطری‌ها"}
        </h1>

        <Suspense fallback={<ProductListSummarySkeleton />}>
          <ProductListSummary
            products={productsPromise}
            brandFiltered={Boolean(activeBrand)}
          />
        </Suspense>

        <ProductSearch />

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={query.brand ? "outline" : "default"}
            className="h-10 rounded-full"
            asChild
          >
            <Link href={allProductsHref}>همهٔ محصولات</Link>
          </Button>
          {query.brand ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-10 rounded-full"
              asChild
            >
              <Link href={allProductsHref}>پاک‌کردن فیلتر برند</Link>
            </Button>
          ) : null}
        </div>

        {categories.length ? (
          <div className="mt-8 flex flex-wrap gap-2" aria-label="دسته‌بندی‌ها">
            <span className={cn(FILTER_CHIP_CLASS, "shadow-e1 border-transparent bg-primary font-medium text-primary-foreground")}>
              همهٔ دسته‌ها
            </span>
            {categories.map((category) => {
              const href = category.slug?.trim()
                ? `/categories/${encodeURIComponent(category.slug.trim())}`
                : null;
              if (!href) {
                return (
                  <span
                    key={category.id}
                    className={cn(FILTER_CHIP_CLASS, "border-border text-muted-foreground")}
                  >
                    {category.title}
                  </span>
                );
              }
              return (
                <Link
                  key={category.id}
                  href={href}
                  className={cn(
                    FILTER_CHIP_CLASS,
                    "border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {category.title}
                </Link>
              );
            })}
          </div>
        ) : null}

        {brands.length ? (
          <div
            id="brands"
            className="mt-5 flex flex-wrap gap-2 scroll-mt-28"
            aria-label="برندها"
          >
            {brands.map((brand) => {
              const active = query.brand === brand.slug;
              return (
                <Link
                  key={brand.id}
                  href={
                    active ? allProductsHref : productListBrandHref(brand.slug)
                  }
                  className={cn(
                    FILTER_CHIP_CLASS,
                    "transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                  aria-current={active ? "true" : undefined}
                >
                  {brand.title}
                </Link>
              );
            })}
          </div>
        ) : null}

        <Suspense fallback={<ProductListResultsSkeleton />}>
          <ProductListResults
            products={productsPromise}
            query={query}
            listName={
              activeBrand ? `برند ${activeBrand.title}` : "همهٔ بطری‌ها"
            }
          />
        </Suspense>
      </section>
    </>
  );
}

/**
 * Total-count line under the heading. Its own boundary because it sits above
 * the search box and filter chips — blocking on it would hold back the entire
 * shell for one sentence.
 */
export async function ProductListSummary({
  products,
  brandFiltered,
}: {
  products: Promise<SettledProductPage>;
  brandFiltered: boolean;
}) {
  const settled = await products;
  const totalItems = settled.ok ? settled.page.pagination.total_items : 0;

  return (
    <p className="mt-3 max-w-xl text-muted-foreground">
      {!settled.ok
        ? "فعلاً فهرست محصولات در دسترس نیست."
        : brandFiltered
          ? `${faNum(totalItems)} محصول از این برند — برای دیدن همهٔ فروشگاه فیلتر را بردارید.`
          : `${faNum(totalItems)} محصول — بر اساس دسته یا برند مرور کنید.`}
    </p>
  );
}

function ProductListSummarySkeleton() {
  return (
    <div className="mt-3 max-w-xl" aria-hidden="true">
      <Skeleton className="h-6 w-72 max-w-full" />
    </div>
  );
}

/** Sort bar, product grid and pagination — everything that needs the catalogue. */
export async function ProductListResults({
  products,
  query,
  listName,
}: {
  products: Promise<SettledProductPage>;
  query: ProductListRouteQuery;
  listName: string;
}) {
  const settled = await products;
  const results = settled.ok ? settled.page.results : [];
  const pagination = settled.ok
    ? settled.page.pagination
    : {
        page: query.page,
        limit: PRODUCT_LIST_PAGE_SIZE,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      };

  if (!settled.ok) {
    return (
      <div className="mt-10">
        <CatalogueLoadError
          title="فهرست محصولات بارگذاری نشد"
          description="دریافت کاتالوگ با خطا روبه‌رو شد. این به‌معنای خالی بودن فروشگاه نیست — دوباره تلاش کنید."
        />
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="mt-10">
        <JsonLd data={productListLd(listName, results)} />
        <EmptyState
          icon={PackageOpen}
          title="محصولی برای نمایش نیست"
          description={
            query.search
              ? "برای این جستجو محصولی پیدا نشد. عبارت دیگری را امتحان کنید یا فیلتر را بردارید."
              : query.brand
                ? "محصولی از این برند برای نمایش نیست. فیلتر برند را بردارید تا همهٔ فروشگاه را ببینید."
                : "هنوز محصول منتشرشده‌ای در فروشگاه نیست."
          }
        />
      </div>
    );
  }

  return (
    <>
      <JsonLd data={productListLd(listName, results)} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <p className="text-sm text-muted-foreground">
          {`نمایش ${faNum(results.length)} از ${faNum(pagination.total_items)} محصول`}
        </p>
        <ProductSort />
      </div>

      <div className={`${PRODUCT_CARD_GRID_CLASS} mt-8`}>
        {results.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <ListPagination
        page={pagination.page}
        totalPages={pagination.total_pages}
        hasPrev={pagination.has_prev}
        hasNext={pagination.has_next}
        prevHref={productListHref(query, query.page - 1)}
        nextHref={productListHref(query, query.page + 1)}
        ariaLabel="صفحه‌بندی محصولات"
        className="mt-12"
      />
    </>
  );
}

/** Mirrors the sort bar plus one full page of cards — same rows, same heights. */
function ProductListResultsSkeleton() {
  return (
    <RouteLoadingRegion as="div" label="در حال بارگذاری محصولات">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-11 w-52 rounded-full" />
      </div>
      <ProductGridSkeleton count={PRODUCT_LIST_PAGE_SIZE} className="mt-8" />
    </RouteLoadingRegion>
  );
}
