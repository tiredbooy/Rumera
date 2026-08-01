import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, PackageOpen, Tags } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/features/catalog/products/api/public";
import {
  ProductCard,
  PRODUCT_CARD_GRID_CLASS,
} from "@/features/catalog/products/components/product-card";
import { getTag } from "@/features/catalog/tags/api/public";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { faNum } from "@/lib/products";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

import {
  parseTagID,
  parseTagPage,
  tagPageHref,
  type TagPageSearchParams,
} from "../routing";
import { TagPagination } from "./tag-pagination";

const PAGE_SIZE = 12;

export async function TagDetailView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: TagPageSearchParams;
}) {
  const [{ id: rawID }, query] = await Promise.all([params, searchParams]);
  const id = parseTagID(rawID);
  if (id === null) notFound();

  const page = parseTagPage(query.page);
  if (page === null) redirect(`/tags/${id}`);

  const tag = await getTag(id);
  if (!tag) notFound();

  const data = await listProducts({
    tag_id: id,
    page,
    limit: PAGE_SIZE,
    sortBy: "created_at",
    orderBy: "desc",
  });
  const basePath = `/tags/${id}`;
  if (page > data.pagination.total_pages) {
    redirect(tagPageHref(basePath, data.pagination.total_pages));
  }
  const structuredProducts = data.results.filter((product) => product.slug);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "برچسب‌ها", path: "/tags" },
            { name: tag.title, path: basePath },
          ]),
          productListLd(
            `محصولات با برچسب ${tag.title}`,
            structuredProducts,
            (page - 1) * PAGE_SIZE + 1,
          ),
        ]}
      />

      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-12 sm:py-16 lg:py-20">
          <nav
            aria-label="مسیر"
            className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              خانه
            </Link>
            <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
            <Link
              href="/tags"
              className="transition-colors hover:text-foreground"
            >
              برچسب‌ها
            </Link>
            <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
            <span className="font-medium text-foreground">{tag.title}</span>
          </nav>

          <p className="eyebrow mb-3">
            <Tags className="size-3.5" aria-hidden /> برچسب منتخب
          </p>
          <h1 className="max-w-3xl text-balance font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
            {tag.title}
          </h1>
          {tag.description ? (
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              {tag.description}
            </p>
          ) : null}
          <p className="mt-5 text-sm text-muted-foreground" role="status">
            {data.pagination.total_items > 0
              ? `${faNum(data.pagination.total_items)} محصول با این برچسب`
              : "هنوز محصولی با این برچسب منتشر نشده است"}
          </p>
        </div>
      </section>

      <section
        className="container-px mx-auto w-full max-w-7xl py-12 sm:py-16"
        aria-labelledby="tag-products-title"
      >
        <h2 id="tag-products-title" className="sr-only">
          محصولات برچسب {tag.title}
        </h2>
        {data.results.length ? (
          <ul className={`${PRODUCT_CARD_GRID_CLASS} list-none p-0`}>
            {data.results.map((product) => (
              <li key={product.id} className="h-full min-w-0">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder
            icon={PackageOpen}
            title="محصولی با این برچسب نیست"
            description="ممکن است محصولات این مجموعه هنوز منتشر نشده باشند. برچسب دیگری را امتحان کنید یا همهٔ محصولات را ببینید."
          >
            <Button variant="outline" asChild>
              <Link href="/tags">برچسب‌های دیگر</Link>
            </Button>
            <Button asChild>
              <Link href="/products">همهٔ محصولات</Link>
            </Button>
          </Placeholder>
        )}

        <TagPagination
          pagination={data.pagination}
          basePath={basePath}
          ariaLabel="صفحه‌بندی محصولات"
        />
      </section>
    </>
  );
}
