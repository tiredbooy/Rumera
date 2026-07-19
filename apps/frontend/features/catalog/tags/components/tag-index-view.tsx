import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, PackageOpen, Tags } from "lucide-react";

import { JsonLd } from "@/components/json-ld";
import { listTags } from "@/features/catalog/tags/api/public";
import { Placeholder } from "@/features/dashboard/components/placeholder";
import { Reveal } from "@/features/motion/components/reveal";
import { faNum } from "@/lib/products";
import { breadcrumbLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/site";

import {
  parseTagPage,
  tagPageHref,
  type TagPageSearchParams,
} from "../routing";
import type { Tag } from "../types";
import { TagPagination } from "./tag-pagination";

const PAGE_SIZE = 24;

export async function TagIndexView({
  searchParams,
}: {
  searchParams: TagPageSearchParams;
}) {
  const params = await searchParams;
  const page = parseTagPage(params.page);
  if (page === null) redirect("/tags");

  const data = await listTags({
    page,
    limit: PAGE_SIZE,
    sortBy: "title",
    orderBy: "asc",
  });
  if (
    data.results.length === 0 &&
    data.pagination.total_items > 0 &&
    page > data.pagination.total_pages
  ) {
    redirect(tagPageHref("/tags", data.pagination.total_pages));
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "برچسب‌ها", path: "/tags" },
          ]),
          tagListLd(data.results, data.pagination.page, PAGE_SIZE),
        ]}
      />

      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-14 sm:py-20 lg:py-24">
          <nav
            aria-label="مسیر"
            className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              خانه
            </Link>
            <ChevronLeft className="size-3.5 opacity-50" aria-hidden />
            <span className="font-medium text-foreground">برچسب‌ها</span>
          </nav>

          <Reveal>
            <p className="eyebrow mb-4">
              <Tags className="size-3.5" aria-hidden /> مسیرهای انتخاب
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              مجموعه را از زاویه‌ای تازه ببینید
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              برچسب‌ها محصولات هم‌حال‌وهوا را کنار هم می‌آورند؛ از انتخاب‌های
              فصلی تا بطری‌های کمیاب و پیشنهادهای مناسب هدیه.
            </p>
            <p className="mt-6 text-sm text-muted-foreground" role="status">
              {`${faNum(data.pagination.total_items)} برچسب برای کاوش`}
            </p>
          </Reveal>
        </div>
      </section>

      <section
        className="container-px mx-auto max-w-7xl py-12 sm:py-16"
        aria-labelledby="tag-directory-title"
      >
        <h2 id="tag-directory-title" className="sr-only">
          فهرست برچسب‌ها
        </h2>
        {data.results.length ? (
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.results.map((tag, index) => (
              <li key={tag.id}>
                <Reveal delay={Math.min(index, 7) * 0.035} y={12}>
                  <Link
                    href={`/tags/${tag.id}`}
                    className="group/tag border-hairline flex min-h-44 h-full flex-col rounded-3xl bg-card p-5 shadow-e1 ring-1 ring-foreground/5 outline-none transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-e2 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none motion-reduce:transition-none sm:p-6"
                  >
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Tags className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 font-serif text-2xl leading-tight transition-colors group-hover/tag:text-primary">
                      {tag.title}
                    </h3>
                    {tag.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {tag.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        مشاهدهٔ محصولات منتخب این برچسب
                      </p>
                    )}
                    <span className="mt-auto inline-flex min-h-11 items-center gap-1 pt-4 text-sm font-semibold text-primary">
                      مشاهدهٔ محصولات
                      <ArrowLeft
                        className="size-4 transition-transform group-hover/tag:-translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder
            icon={PackageOpen}
            title="هنوز برچسبی برای نمایش نیست"
            description="با اضافه‌شدن مجموعه‌های تازه، مسیرهای بیشتری برای کاوش اینجا ظاهر می‌شود."
          >
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
            >
              مشاهدهٔ همهٔ محصولات
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Placeholder>
        )}

        <TagPagination
          pagination={data.pagination}
          basePath="/tags"
          ariaLabel="صفحه‌بندی برچسب‌ها"
        />
      </section>
    </>
  );
}

function tagListLd(tags: Tag[], page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "برچسب‌های رومرا",
    itemListElement: tags.map((tag, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      name: tag.title,
      url: absoluteUrl(`/tags/${tag.id}`),
    })),
  };
}
