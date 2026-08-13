import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { ResultsHeading } from "@/components/results-heading";
import { Button } from "@/components/ui/button";
import {
  listFeaturedJournalPosts,
  listJournalPage,
} from "@/features/journal/api/server";
import { JournalCard } from "@/features/journal/components/journal-card";
import { JournalExplorer } from "@/features/journal/components/journal-explorer";
import {
  getJournalSortLabel,
  JOURNAL_PAGE_SIZE,
  journalPageHref,
  type JournalListSearchParams,
  parseJournalRouteQuery,
} from "@/features/journal/routing";
import { Reveal } from "@/features/motion/components/reveal";
import { faNum } from "@/lib/products";
import { breadcrumbLd, contentListLd } from "@/lib/seo/jsonld";

const RESULTS_ID = "journal-results-title";

export type { JournalListSearchParams } from "@/features/journal/routing";

export async function JournalListView({
  searchParams,
}: {
  searchParams: JournalListSearchParams;
}) {
  const rawSearchParams = await searchParams;
  const query = parseJournalRouteQuery(rawSearchParams);
  if (query.needsRedirect) redirect(journalPageHref(query, query.page));

  const isUnfiltered = !query.q && query.sort === "new";
  const editorialFeatured = isUnfiltered
    ? (await listFeaturedJournalPosts(1).catch(() => []))[0]
    : undefined;
  const { posts, pagination } = await listJournalPage({
    page: query.page,
    limit: JOURNAL_PAGE_SIZE,
    search: query.q,
    sortBy: query.sortBy,
    orderBy: query.orderBy,
    ...(editorialFeatured ? { exclude_id: editorialFeatured.id } : {}),
  });

  const finalPage =
    pagination.total_items === 0 ? 1 : Math.max(1, pagination.total_pages);
  if (query.page > finalPage) redirect(journalPageHref(query, finalPage));

  const lead =
    query.page === 1
      ? (editorialFeatured ?? (isUnfiltered ? posts[0] : undefined))
      : undefined;
  const rest = lead ? posts.filter((post) => post.id !== lead.id) : posts;
  const hasFilters = Boolean(query.q) || query.sort !== "new";
  const totalItems =
    pagination.total_items + (editorialFeatured && isUnfiltered ? 1 : 0);
  const resultTitle = query.q
    ? `نتیجهٔ جستجو برای «${query.q}»`
    : query.sort === "popular"
      ? "نوشته‌های پربازدید"
      : "تازه‌ترین نوشته‌ها";
  const status =
    totalItems > 0
      ? `${faNum(totalItems)} نوشته، صفحهٔ ${faNum(query.page)} از ${faNum(finalPage)}`
      : hasFilters
        ? "نوشته‌ای مطابق فیلترها نیست"
        : "هنوز نوشته‌ای منتشر نشده است";
  const structuredItems = [lead, ...rest]
    .filter((post) => post !== undefined)
    .map((post) => ({
      name: post.title,
      path: `/journal/${encodeURIComponent(post.slug)}`,
    }));
  const structuredStart =
    query.page === 1
      ? 1
      : (query.page - 1) * JOURNAL_PAGE_SIZE +
        (editorialFeatured ? 2 : 1);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "ژورنال", path: "/journal" },
          ]),
          contentListLd(
            resultTitle,
            structuredItems,
            structuredStart,
          ),
        ]}
      />

      <section className="content-header-glow relative overflow-hidden border-b border-border/50">
        <div className="container-px mx-auto max-w-7xl py-14 sm:py-16 lg:py-20">
          <Reveal>
            <p className="eyebrow mb-4">
              <BookOpen className="size-3.5" aria-hidden="true" /> ژورنال رومرا
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
        aria-labelledby={RESULTS_ID}
        data-journal-results
      >
        {lead ? (
          <Reveal className="mb-12 sm:mb-16">
            <JournalCard
              post={lead}
              featured
              featuredLabel={
                editorialFeatured ? "نوشتهٔ منتخب" : "تازه‌ترین نوشته"
              }
              priority
            />
          </Reveal>
        ) : null}

        <JournalExplorer
          key={`${query.q ?? ""}:${query.sort}`}
          query={query}
        />
        <ResultsHeading
          id={RESULTS_ID}
          eyebrow={getJournalSortLabel(query.sort)}
          title={resultTitle}
          status={status}
          focusKey={`${query.page}:${query.q ?? ""}:${query.sort}:${totalItems}`}
        />

        {rest.length === 0 ? (
          lead ? (
            <p className="mt-6 rounded-2xl bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
              این تنها نوشتهٔ منتشرشده در ژورنال است.
            </p>
          ) : (
            <div className="border-hairline mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-20 text-center ring-1 ring-foreground/5">
              <BookOpen
                className="size-10 text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="font-serif text-2xl">
                {hasFilters ? "نوشته‌ای پیدا نشد" : "به‌زودی"}
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {hasFilters
                  ? "عبارت یا مرتب‌سازی دیگری را امتحان کنید."
                  : "هنوز نوشته‌ای منتشر نشده است. به‌زودی سر بزنید."}
              </p>
              {hasFilters ? (
                <Button variant="outline" asChild className="mt-2">
                  <Link href="/journal">نمایش همهٔ نوشته‌ها</Link>
                </Button>
              ) : null}
            </div>
          )
        ) : (
          <ul
            className="mt-6 grid list-none gap-6 p-0 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3"
            data-journal-grid
          >
            {rest.map((post, index) => (
              <li key={post.id} className="contents">
                <JournalCard post={post} index={index} headingLevel={3} />
              </li>
            ))}
          </ul>
        )}

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
                <Link
                  href={journalPageHref(query, query.page - 1, RESULTS_ID)}
                  rel="prev"
                >
                  <ArrowRight className="size-4" aria-hidden="true" /> قبلی
                </Link>
              ) : (
                <span>
                  <ArrowRight className="size-4" aria-hidden="true" /> قبلی
                </span>
              )}
            </Button>
            <span className="text-sm text-muted-foreground" aria-current="page">
              صفحهٔ {faNum(query.page)} از {faNum(finalPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_next}
              asChild={pagination.has_next}
            >
              {pagination.has_next ? (
                <Link
                  href={journalPageHref(query, query.page + 1, RESULTS_ID)}
                  rel="next"
                >
                  بعدی <ArrowLeft className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  بعدی <ArrowLeft className="size-4" aria-hidden="true" />
                </span>
              )}
            </Button>
          </nav>
        ) : null}
      </section>
    </>
  );
}
