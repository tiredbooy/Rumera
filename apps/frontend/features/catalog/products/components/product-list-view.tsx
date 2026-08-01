import Link from "next/link";
import { ArrowLeft, ArrowRight, PackageOpen } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/features/catalog/categories/api";
import { listProducts } from "@/features/catalog/products/api/public";
import {
  ProductCard,
  PRODUCT_CARD_GRID_CLASS,
} from "@/features/catalog/products/components/product-card";
import { ProductSort } from "@/features/catalog/products/components/product-sort";
import type { ProductSortField } from "@/features/catalog/products/queries";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { buildQuery } from "@/lib/api/qs";
import { faNum } from "@/lib/products";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

export type ProductListSearchParams = {
  page?: string;
  search?: string;
  sortBy?: ProductSortField;
  orderBy?: "asc" | "desc";
};

type ProductListViewProps = {
  searchParams: Promise<ProductListSearchParams>;
};

export async function ProductListView({ searchParams }: ProductListViewProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.search?.trim() || undefined;

  const [data, categories] = await Promise.all([
    listProducts({
      page,
      limit: 12,
      search,
      sortBy: sp.sortBy,
      orderBy: sp.orderBy,
    }),
    listCategories(),
  ]);
  const { results, pagination } = data;

  const pageHref = (p: number) =>
    `/products${buildQuery({ page: p, search, sortBy: sp.sortBy, orderBy: sp.orderBy })}`;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "فروشگاه", path: "/products" },
          ]),
          productListLd("همهٔ بطری‌ها", results),
        ]}
      />

      <section className="container-px mx-auto w-full max-w-7xl py-14">
        <p className="eyebrow mb-3">کاتالوگ کامل</p>
        <h1 className="font-serif text-5xl">فروشگاه بطری‌ها</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          {`${faNum(pagination.total_items)} برچسب منتخب — بر اساس دسته مرور کنید یا همه را ببینید.`}
        </p>

        {categories.length ? (
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="shadow-e1 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
              همه
            </span>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={c.slug ? `/categories/${c.slug}` : "/categories"}
                className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {c.title}
              </Link>
            ))}
          </div>
        ) : null}

        {results.length ? (
          <>
            {/* Toolbar — result count + sort */}
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
                    <Link href={pageHref(page - 1)}>
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
                    <Link href={pageHref(page + 1)}>
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
