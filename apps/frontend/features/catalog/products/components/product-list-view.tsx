import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, PackageOpen } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
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
import { ProductSort } from "@/features/catalog/products/components/product-sort";
import {
  parseProductListRouteQuery,
  productListBrandHref,
  productListHref,
  PRODUCT_LIST_PAGE_SIZE,
  type ProductListSearchParamsRecord,
} from "@/features/catalog/products/list-routing";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

type ProductListViewProps = {
  searchParams: Promise<ProductListSearchParamsRecord>;
};

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

  const [data, categories, brandsPage, selectedBrand] = await Promise.all([
    listProducts({
      page: query.page,
      limit: PRODUCT_LIST_PAGE_SIZE,
      search: query.search,
      brand: query.brand,
      sortBy: query.sortBy,
      orderBy: query.orderBy,
    }),
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
  const { results, pagination } = data;
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
          productListLd(
            activeBrand ? `برند ${activeBrand.title}` : "همهٔ بطری‌ها",
            results,
          ),
        ]}
      />

      <section className="container-px mx-auto w-full max-w-7xl py-14">
        <p className="eyebrow mb-3">کاتالوگ کامل</p>
        <h1 className="font-serif text-5xl">
          {activeBrand ? activeBrand.title : "فروشگاه بطری‌ها"}
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {activeBrand
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
            <span className="shadow-e1 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
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
                    className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground"
                  >
                    {category.title}
                  </span>
                );
              }
              return (
                <Link
                  key={category.id}
                  href={href}
                  className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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
                    "rounded-full border px-4 py-1.5 text-sm transition-colors",
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

        {results.length ? (
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

            {pagination.total_pages > 1 ? (
              <div className="mt-12 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_prev}
                  asChild={pagination.has_prev}
                >
                  {pagination.has_prev ? (
                    <Link href={pageHref(query.page - 1)}>
                      <ArrowRight className="size-4" /> قبلی
                    </Link>
                  ) : (
                    <span>
                      <ArrowRight className="size-4" /> قبلی
                    </span>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحهٔ {faNum(pagination.page)} از{" "}
                  {faNum(pagination.total_pages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_next}
                  asChild={pagination.has_next}
                >
                  {pagination.has_next ? (
                    <Link href={pageHref(query.page + 1)}>
                      بعدی <ArrowLeft className="size-4" />
                    </Link>
                  ) : (
                    <span>
                      بعدی <ArrowLeft className="size-4" />
                    </span>
                  )}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-10">
            <Placeholder
              icon={PackageOpen}
              title="محصولی برای نمایش نیست"
              description="در حال حاضر محصولی یافت نشد. اگر سرویس در دسترس نیست، بعداً دوباره تلاش کنید."
            />
          </div>
        )}
      </section>
    </>
  );
}
