import Link from "next/link";
import { ArrowLeft, Search, SearchX, Sparkles } from "lucide-react";

import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { ListPagination } from "@/components/list-pagination";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/features/catalog/categories/api";
import { listProducts } from "@/features/catalog/products/api/public";
import { CatalogueLoadError } from "@/features/catalog/products/components/catalogue-load-error";
import {
  ProductCard,
  PRODUCT_CARD_GRID_CLASS,
} from "@/features/catalog/products/components/product-card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { SearchResultProductCard } from "@/features/storefront/search/components/search-result-product-card";
import type { Paginated, Pagination } from "@/lib/api/types";
import { faNum } from "@/lib/products";

export const SEARCH_PAGE_SIZE = 24;

type SearchViewProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

type SettledProductList =
  | { ok: true; results: ProductListItem[]; pagination: Pagination | null }
  | { ok: false };

const EMPTY_PAGE: SettledProductList = {
  ok: true,
  results: [],
  pagination: null,
};

function parseSearchPage(raw?: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function searchPageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}

async function settleProducts(
  promise: Promise<Paginated<ProductListItem>>,
): Promise<SettledProductList> {
  try {
    const page = await promise;
    return {
      ok: true,
      results: page.results ?? [],
      pagination: page.pagination ?? null,
    };
  } catch {
    return { ok: false };
  }
}

export async function SearchView({ searchParams }: SearchViewProps) {
  const { q = "", page: rawPage } = await searchParams;
  const query = q.trim();
  const page = parseSearchPage(rawPage);

  const [searchPage, categories, suggestionsPage] = await Promise.all([
    query
      ? settleProducts(
          listProducts({ search: query, page, limit: SEARCH_PAGE_SIZE }),
        )
      : Promise.resolve(EMPTY_PAGE),
    listCategories().catch(() => []),
    settleProducts(listProducts({ page: 1, limit: 4 })),
  ]);

  const searchFailed = Boolean(query) && !searchPage.ok;
  const results = searchPage.ok ? searchPage.results : [];
  const pagination = searchPage.ok ? searchPage.pagination : null;
  const totalItems = pagination?.total_items ?? results.length;
  const totalPages = Math.max(1, pagination?.total_pages ?? 1);

  if (query && pagination && page > totalPages && totalItems > 0) {
    redirect(searchPageHref(query, totalPages));
  }

  const suggestions = suggestionsPage.ok ? suggestionsPage.results : [];
  const showZero = Boolean(query) && !searchFailed && totalItems === 0;
  const showHits = Boolean(query) && !searchFailed && results.length > 0;
  const showSuggestions = !showHits && !searchFailed && suggestions.length > 0;

  return (
    <>
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-3xl py-14 text-center sm:py-16">
          <p className="eyebrow mb-3 justify-center">
            <Sparkles className="size-3.5" /> جستجو در رومرا
          </p>
          <h1 className="section-title">دنبال چه می‌گردید؟</h1>
          <form
            action="/search"
            role="search"
            className="relative mx-auto mt-8 max-w-xl"
          >
            <Search className="pointer-events-none absolute top-1/2 start-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="نام، توضیحات، برند، دسته، کد، SKU یا برچسب…"
              aria-label="جستجوی فروشگاه"
              className="shadow-e2 h-14 w-full rounded-full border border-border/70 bg-background/80 ps-12 pe-28 text-base outline-none backdrop-blur-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <Button
              type="submit"
              className="absolute top-1/2 end-2 h-10 -translate-y-1/2 rounded-full px-5"
            >
              جستجو
            </Button>
          </form>
        </div>
      </section>

      <section className="container-px mx-auto w-full max-w-7xl py-12 sm:py-14">
        {showHits ? (
          <>
            <p className="text-muted-foreground">
              {`${faNum(totalItems)} نتیجه برای «`}
              <span className="font-medium text-foreground">{query}</span>
              {"»"}
            </p>
            <div className={`${PRODUCT_CARD_GRID_CLASS} mt-8`}>
              {results.map((product) => (
                <SearchResultProductCard
                  key={product.id}
                  product={product}
                  query={query}
                />
              ))}
            </div>
            {pagination ? (
              <ListPagination
                page={pagination.page}
                totalPages={totalPages}
                hasPrev={pagination.has_prev}
                hasNext={pagination.has_next}
                prevHref={searchPageHref(query, pagination.page - 1)}
                nextHref={searchPageHref(query, pagination.page + 1)}
                ariaLabel="صفحه‌بندی نتایج جستجو"
                className="mt-12"
              />
            ) : null}
          </>
        ) : null}

        {searchFailed ? (
          <CatalogueLoadError
            title="جستجو انجام نشد"
            description="بارگذاری نتایج با خطا روبه‌رو شد. این به‌معنای صفر نتیجه نیست — دوباره تلاش کنید."
          />
        ) : null}

        {showZero ? (
          <EmptyState
            icon={SearchX}
            title={`نتیجه‌ای برای «${query}» پیدا نشد`}
            description="املا را چک کنید یا کلمه‌ای کوتاه‌تر بزنید. جستجو روی نام محصول، توضیحات، برند، دسته، کد، SKU و برچسب است — از دسته‌ها یا پیشنهادهای زیر هم می‌توانید شروع کنید."
            className="mx-auto max-w-lg"
          >
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/products">
                  مرور فروشگاه <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/search">پاک کردن جستجو</Link>
              </Button>
            </div>
          </EmptyState>
        ) : null}

        {!query && !showHits ? (
          <div className="mx-auto max-w-lg text-center">
            <p className="text-muted-foreground">
              عبارتی وارد کنید یا از دسته‌بندی‌ها و پیشنهادهای زیر شروع کنید.
            </p>
          </div>
        ) : null}

        {categories.length ? (
          <div className={showHits ? "mt-16" : "mt-14"}>
            <p className="eyebrow mb-4 justify-center text-center">
              جستجو بر اساس دسته
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={c.slug ? `/categories/${c.slug}` : "/categories"}
                  className="rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
                >
                  {c.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {showSuggestions ? (
          <div className="mt-16">
            <p className="eyebrow mb-2 justify-center text-center">
              {showZero ? "شاید این‌ها را بپسندید" : "پیشنهاد شروع"}
            </p>
            <h2 className="section-title mb-8 text-center text-2xl sm:text-3xl">
              {showZero ? "نمونه‌هایی از سردابه" : "تازه‌های فروشگاه"}
            </h2>
            <div className={PRODUCT_CARD_GRID_CLASS}>
              {suggestions.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline" className="h-11">
                <Link href="/products">مشاهدهٔ همهٔ محصولات</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
