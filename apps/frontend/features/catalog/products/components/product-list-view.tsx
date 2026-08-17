import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, PackageOpen } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
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
import { ProductSort } from "@/features/catalog/products/components/product-sort";
import {
  parseProductListRouteQuery,
  productListBrandHref,
  productListHref,
  PRODUCT_LIST_PAGE_SIZE,
  type ProductListSearchParamsRecord,
} from "@/features/catalog/products/list-routing";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

type ProductListViewProps = {
  searchParams: Promise<ProductListSearchParamsRecord>;
};

const FILTER_CHIP_CLASS =
  "inline-flex min-h-8 items-center rounded-full border px-4 py-1.5 text-sm [@media(any-pointer:coarse)]:min-h-11";

export async function ProductListView({ searchParams }: ProductListViewProps) {
  const raw = await searchParams;
  const query = parseProductListRouteQuery(raw);

  if (query.legacyBrandId && !query.brand) {
    const legacyBrand = await getBrand(query.legacyBrandId).catch(() => null);
    redirect(
      productListHref(
        {
          search: query.search,
          brand: legacyBrand?.slug,
          sortBy: query.sortBy,
          orderBy: query.orderBy,
        },
        query.page,
      ),
    );
  }

  if (query.needsRedirect) {
    redirect(productListHref(query, query.page));
  }

  const [productsResult, categories, brandsPage, selectedBrand] =
    await Promise.all([
      listProducts({
        page: query.page,
        limit: PRODUCT_LIST_PAGE_SIZE,
        search: query.search,
        brand: query.brand,
        sortBy: query.sortBy,
        orderBy: query.orderBy,
      })
        .then((page) => ({ ok: true as const, page }))
        .catch(() => ({ ok: false as const })),
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
  const loadError = !productsResult.ok;
  const results = productsResult.ok ? productsResult.page.results : [];
  const pagination = productsResult.ok
    ? productsResult.page.pagination
    : {
        page: query.page,
        limit: PRODUCT_LIST_PAGE_SIZE,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      };
  const brands = brandsPage.results ?? [];
  const activeBrand =
    selectedBrand ?? brands.find((brand) => brand.slug === query.brand);

  const pageHref = (page: number) => productListHref(query, page);
  const allProductsHref = productListHref(
    {
      search: query.search,
      sortBy: query.sortBy,
      orderBy: query.orderBy,
    },
    1,
  );

  if (query.brand && !activeBrand) {
    redirect(allProductsHref);
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
          ]),
          ...(loadError
            ? []
            : [
                productListLd(
                  activeBrand ? `برند ${activeBrand.title}` : "همهٔ بطری‌ها",
                  results,
                ),
              ]),
        ]}
      />

      <section className="container-px mx-auto w-full max-w-7xl py-14">
        <p className="eyebrow mb-3">کاتالوگ کامل</p>
        <h1 className="font-serif text-5xl">
          {activeBrand ? activeBrand.title : "فروشگاه بطری‌ها"}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {loadError
            ? "فعلاً فهرست محصولات در دسترس نیست."
            : activeBrand
              ? `${faNum(pagination.total_items)} محصول از این برند — برای دیدن همهٔ فروشگاه فیلتر را بردارید.`
              : `${faNum(pagination.total_items)} محصول — بر اساس دسته یا برند مرور کنید.`}
        </p>

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

        {loadError ? (
          <div className="mt-10">
            <CatalogueLoadError
              title="فهرست محصولات بارگذاری نشد"
              description="دریافت کاتالوگ با خطا روبه‌رو شد. این به‌معنای خالی بودن فروشگاه نیست — دوباره تلاش کنید."
            />
          </div>
        ) : results.length ? (
          <>
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
              prevHref={pageHref(query.page - 1)}
              nextHref={pageHref(query.page + 1)}
              ariaLabel="صفحه‌بندی محصولات"
              className="mt-12"
            />
          </>
        ) : (
          <div className="mt-10">
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
        )}
      </section>
    </>
  );
}
