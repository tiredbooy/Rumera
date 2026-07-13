import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowLeft, ArrowRight } from "lucide-react";

import { buildMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { Reveal } from "@/features/motion/components/reveal";
import { Button } from "@/components/ui/button";
import { JournalExplorer } from "@/features/journal/components/journal-explorer";
import { JournalCard } from "@/features/journal/components/journal-card";
import { listJournalPage } from "@/features/journal/api/server";
import { faNum } from "@/lib/products";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "ژورنال",
  description:
    "یادداشت‌ها، راهنماها و داستان‌هایی از دنیای نوشیدنی و سبک زندگی — قابل جستجو و خواندنی.",
  path: "/journal",
});

const PAGE_SIZE = 24;

type SearchParams = Promise<{ page?: string }>;

function pageHref(page: number): string {
  return page > 1 ? `/journal?page=${page}` : "/journal";
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const pageParam = Number(sp.page);
  const page = Number.isFinite(pageParam) && pageParam > 1 ? pageParam : 1;
  // The featured lead story only headlines the untouched first page.
  const isFirstPage = page === 1;

  const { posts, pagination } = await listJournalPage({ page, limit: PAGE_SIZE });

  // Headline the post the editors marked `is_featured`; fall back to the newest.
  const featured = isFirstPage
    ? (posts.find((p) => p.is_featured) ?? posts[0])
    : undefined;
  const rest = featured ? posts.filter((p) => p.id !== featured.id) : posts;

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "ژورنال", path: "/journal" },
        ])}
      />

      {/* Header */}
      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-4">
              <BookOpen className="size-3.5" aria-hidden /> ژورنال رومرا
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              خواندنی‌هایی برای کنجکاوها
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              راهنماها، داستان‌ها و ایده‌هایی که تجربهٔ خرید و میزبانی‌تان را
              کامل‌تر می‌کنند.
            </p>
          </Reveal>
        </div>
      </section>

      <section
        className="container-px mx-auto max-w-7xl py-12 sm:py-16"
        aria-label="فهرست نوشته‌های ژورنال"
        data-journal-results
      >
        {posts.length === 0 ? (
          <div className="border-hairline flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-24 text-center ring-1 ring-foreground/5">
            <BookOpen
              className="size-10 text-muted-foreground/50"
              aria-hidden
            />
            <p className="font-serif text-2xl">به‌زودی</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              هنوز نوشته‌ای منتشر نشده است. به‌زودی سر بزنید.
            </p>
          </div>
        ) : (
          <>
            {/* Featured lead story — wide editorial hero */}
            {featured ? (
              <Reveal className="mb-12 sm:mb-16">
                <JournalCard post={featured} featured priority />
              </Reveal>
            ) : null}

            {rest.length > 0 ? (
              <JournalExplorer posts={rest} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {faNum(posts.length)} نوشته
              </p>
            )}

            {/* Pagination — only the rest grid paginates; the explorer searches within the page. */}
            {pagination.total_pages > 1 ? (
              <nav
                className="mt-12 flex items-center justify-center gap-3"
                aria-label="صفحه‌بندی ژورنال"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_prev}
                  asChild={pagination.has_prev}
                >
                  {pagination.has_prev ? (
                    <Link href={pageHref(pagination.page - 1)}>
                      <ArrowRight className="size-4" aria-hidden /> قبلی
                    </Link>
                  ) : (
                    <span>
                      <ArrowRight className="size-4" aria-hidden /> قبلی
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
                    <Link href={pageHref(pagination.page + 1)}>
                      بعدی <ArrowLeft className="size-4" aria-hidden />
                    </Link>
                  ) : (
                    <span>
                      بعدی <ArrowLeft className="size-4" aria-hidden />
                    </span>
                  )}
                </Button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
