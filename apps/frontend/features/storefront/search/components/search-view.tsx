import Link from "next/link";
import { ArrowLeft, Search, SearchX, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listCategories } from "@/features/catalog/categories/api";
import { listProducts } from "@/features/catalog/products/api/public";
import {
  ProductCard,
  PRODUCT_CARD_GRID_CLASS,
} from "@/features/catalog/products/components/product-card";
import type { ProductListItem } from "@/features/catalog/products/types";
import { SearchResultProductCard } from "@/features/storefront/search/components/search-result-product-card";
import { faNum } from "@/lib/products";

type SearchViewProps = {
  searchParams: Promise<{ q?: string }>;
};

async function settleProducts(
  promise: Promise<{ results: ProductListItem[] }>,
): Promise<ProductListItem[]> {
  try {
    const page = await promise;
    return page.results ?? [];
  } catch {
    return [];
  }
}

export async function SearchView({ searchParams }: SearchViewProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const [results, categories, suggestions] = await Promise.all([
    query
      ? settleProducts(listProducts({ search: query, limit: 24 }))
      : Promise.resolve([] as ProductListItem[]),
    listCategories().catch(() => []),
    // Soft suggestions when idle or zero hits — catalogue first page.
    settleProducts(listProducts({ page: 1, limit: 4 })),
  ]);

  const showZero = Boolean(query) && results.length === 0;
  const showHits = Boolean(query) && results.length > 0;
  const showSuggestions = !showHits && suggestions.length > 0;

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
              placeholder="نام محصول، برند یا دسته…"
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
              {`${faNum(results.length)} نتیجه برای «`}
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
          </>
        ) : null}

        {showZero ? (
          <div className="border-hairline mx-auto flex max-w-lg flex-col items-center rounded-3xl bg-card/40 px-6 py-14 text-center ring-1 ring-foreground/5">
            <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <SearchX className="size-7" aria-hidden />
            </span>
            <h2 className="font-serif text-2xl">
              نتیجه‌ای برای «{query}» پیدا نشد
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              املا را چک کنید یا کلمه‌ای کوتاه‌تر بزنید. فعلاً جستجو روی{" "}
              <strong className="font-medium text-foreground">نام محصول</strong>{" "}
              است — از دسته‌ها یا پیشنهادهای زیر هم می‌توانید شروع کنید.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/products">
                  مرور فروشگاه <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/search">پاک کردن جستجو</Link>
              </Button>
            </div>
          </div>
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
