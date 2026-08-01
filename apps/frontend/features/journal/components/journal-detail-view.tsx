import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Eye, ShoppingBag } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { EditorialContent } from "@/components/editorial-content";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { getProductById } from "@/features/catalog/products/api/public";
import type { ProductDetail } from "@/features/catalog/products/types";
import {
  getJournalPostBySlug,
  listRelatedJournalPosts,
} from "@/features/journal/api/server";
import { ArticleProductCard } from "@/features/journal/components/article-product-card";
import { JournalCard } from "@/features/journal/components/journal-card";
import { ShareLinks } from "@/features/journal/components/share-links";
import { formatJournalDate, formatReadingTime } from "@/features/journal/utils";
import { faNum } from "@/lib/products";
import { breadcrumbLd, journalArticleLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/site";

type JournalDetailViewProps = {
  params: Promise<{ slug: string }>;
};

export async function JournalDetailView({ params }: JournalDetailViewProps) {
  const { slug } = await params;
  const post = await getJournalPostBySlug(slug);
  if (!post) notFound();

  const productIDs = Array.from(new Set(post.product_ids ?? [])).slice(0, 4);
  const [productResults, relatedResult] = await Promise.all([
    Promise.allSettled(productIDs.map((id) => getProductById(id))),
    Promise.allSettled([listRelatedJournalPosts(post, 3)]),
  ]);
  const products: ProductDetail[] = [];
  let missingProductCount = 0;
  let failedProductCount = 0;
  for (const result of productResults) {
    if (result.status === "rejected") {
      failedProductCount += 1;
    } else if (!result.value?.slug?.trim()) {
      missingProductCount += 1;
    } else {
      products.push(result.value);
    }
  }
  const relatedRequest = relatedResult[0];
  const related =
    relatedRequest.status === "fulfilled" ? relatedRequest.value : [];
  const relatedUnavailable = relatedRequest.status === "rejected";

  const url = absoluteUrl(`/journal/${encodeURIComponent(post.slug)}`);

  return (
    <>
      <JsonLd
        data={[
          journalArticleLd(post),
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "ژورنال", path: "/journal" },
            {
              name: post.title,
              path: `/journal/${encodeURIComponent(post.slug)}`,
            },
          ]),
        ]}
      />

      <article aria-labelledby="journal-article-title">
        <header className="cellar-glow border-b border-border/60">
          <div className="container-px mx-auto max-w-3xl py-14 text-center sm:py-16">
            <nav
              className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground"
              aria-label="مسیر صفحه"
            >
              <Link
                href="/"
                className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                خانه
              </Link>
              <span aria-hidden>/</span>
              <Link
                href="/journal"
                className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                ژورنال
              </Link>
              <span aria-hidden>/</span>
              <span className="text-foreground" aria-current="page">
                {post.title}
              </span>
            </nav>

            {post.categories.length > 0 ? (
              <div className="mb-5 flex flex-wrap justify-center gap-2">
                {post.categories.map((c) => (
                  <Badge key={c.id} variant="secondary">
                    {c.name}
                  </Badge>
                ))}
              </div>
            ) : null}

            <h1
              id="journal-article-title"
              className="text-balance font-serif text-4xl leading-[1.1] sm:text-5xl"
            >
              {post.title}
            </h1>

            {post.excerpt ? (
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {post.published_at ? (
                <time dateTime={post.published_at}>
                  {formatJournalDate(post.published_at)}
                </time>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />{" "}
                {formatReadingTime(post.time_to_read)}
              </span>
              {post.total_reads > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-4" aria-hidden />{" "}
                  {faNum(post.total_reads)} بازدید
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <figure className="container-px mx-auto max-w-4xl pt-12">
          <div className="border-hairline relative aspect-[16/9] overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
            <SmartImage
              src={post.image_url}
              alt={post.image_alt?.trim() || post.title}
              monogram={post.title.charAt(0)}
              fallbackClassName="from-primary/20 via-card to-secondary"
              sizes="(max-width: 1024px) 100vw, 56rem"
              priority
            />
          </div>
        </figure>

        <div className="container-px mx-auto max-w-3xl py-14 sm:py-16">
          <EditorialContent
            content={post.content}
            emptyMessage="متن این نوشته فعلاً در دسترس نیست."
          />

          {/* Share */}
          <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-border/60 pt-8">
            <span className="text-sm font-medium">هم‌رسانی:</span>
            <ShareLinks url={url} title={post.title} />
          </div>
        </div>
      </article>

      {/* Shop this article */}
      {productIDs.length > 0 ? (
        <section className="border-t border-border/60 bg-card/30">
          <div className="container-px mx-auto max-w-5xl py-16 sm:py-20">
            <p className="eyebrow mb-2">
              <ShoppingBag className="size-3.5" aria-hidden /> از این نوشته
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl">محصولات مرتبط</h2>
            {products.length > 0 ? (
              <>
                <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
                  {products.map((p) => (
                    <ArticleProductCard key={p.id} product={p} />
                  ))}
                </div>
                {failedProductCount > 0 || missingProductCount > 0 ? (
                  <p
                    className="mt-6 rounded-2xl bg-muted/60 px-5 py-4 text-sm text-muted-foreground"
                    role="status"
                  >
                    اطلاعات برخی محصولات معرفی‌شده کامل دریافت نشد.
                  </p>
                ) : null}
              </>
            ) : (
              <p
                className="mt-6 rounded-2xl bg-muted/60 px-5 py-4 text-sm text-muted-foreground"
                role="status"
              >
                {failedProductCount > 0
                  ? "دریافت محصولات معرفی‌شده موقتاً کامل نشد. خود نوشته همچنان در دسترس است."
                  : "محصولات معرفی‌شده در این نوشته هم‌اکنون در فروشگاه در دسترس نیستند."}
              </p>
            )}
          </div>
        </section>
      ) : null}

      {/* Read next */}
      {related.length > 0 || relatedUnavailable ? (
        <section className="container-px mx-auto max-w-7xl py-16 sm:py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">ادامه بدهید</p>
              <h2 className="font-serif text-3xl sm:text-4xl">بیشتر بخوانید</h2>
            </div>
            <Link
              href="/journal"
              className="group/all inline-flex items-center gap-1.5 rounded text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              همهٔ نوشته‌ها
              <ArrowLeft
                className="size-4 transition-transform duration-300 group-hover/all:-translate-x-1"
                aria-hidden
              />
            </Link>
          </div>
          {related.length > 0 ? (
            <ul className="mt-10 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {related.map((p, i) => (
                <li key={p.id} className="contents">
                  <JournalCard post={p} index={i} headingLevel={3} />
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="mt-8 rounded-2xl bg-muted/60 px-5 py-4 text-sm text-muted-foreground"
              role="status"
            >
              نوشته‌های پیشنهادی موقتاً در دسترس نیستند.
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
