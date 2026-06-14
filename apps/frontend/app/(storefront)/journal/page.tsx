import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, BookOpen, Clock, Eye } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { Reveal } from "@/components/motion/reveal"
import { SmartImage } from "@/components/smart-image"
import { JournalExplorer } from "@/components/journal/journal-explorer"
import { listBlogs, formatBlogDate, readingTime } from "@/lib/journal"
import { faNum } from "@/lib/products"

export const revalidate = 3600

export const metadata: Metadata = buildMetadata({
  title: "ژورنال",
  description:
    "یادداشت‌ها، راهنماها و داستان‌هایی از دنیای نوشیدنی و سبک زندگی — قابل جستجو و خواندنی.",
  path: "/journal",
})

export default async function JournalPage() {
  const posts = await listBlogs()
  const [featured, ...rest] = posts

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "ژورنال", path: "/journal" },
        ])}
      />

      {/* Header */}
      <section className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-14">
          <Reveal>
            <p className="eyebrow mb-3">
              <BookOpen className="size-3.5" /> ژورنال رومرا
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl">
              خواندنی‌هایی برای کنجکاوها
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              راهنماها، داستان‌ها و ایده‌هایی که تجربهٔ خرید و میزبانی‌تان را
              کامل‌تر می‌کنند.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl py-12">
        {posts.length === 0 ? (
          <div className="border-hairline flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-20 text-center ring-1 ring-foreground/5">
            <BookOpen className="size-10 text-muted-foreground/50" />
            <p className="font-serif text-2xl">به‌زودی</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              هنوز نوشته‌ای منتشر نشده است. به‌زودی سر بزنید.
            </p>
          </div>
        ) : (
          <>
            {/* Featured (latest) */}
            {featured ? (
              <Reveal>
                <Link
                  href={`/journal/${featured.slug}`}
                  className="group/feat border-hairline relative mb-12 grid overflow-hidden rounded-[2rem] bg-card ring-1 ring-foreground/5 transition-all hover:ring-primary/30 lg:grid-cols-2"
                >
                  <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto">
                    <div className="absolute inset-0 transition-transform duration-700 group-hover/feat:scale-105">
                      <SmartImage
                        src={null}
                        alt={featured.title}
                        monogram={featured.title.charAt(0)}
                        fallbackClassName="from-primary/20 via-card to-secondary"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-4 p-8 sm:p-10">
                    <span className="eyebrow">نوشتهٔ منتخب</span>
                    <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
                      {featured.title}
                    </h2>
                    {featured.excerpt ? (
                      <p className="text-muted-foreground">{featured.excerpt}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {featured.published_at ? (
                        <span>{formatBlogDate(featured.published_at)}</span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" /> {readingTime(featured.time_to_read)}
                      </span>
                      {featured.total_reads > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" /> {faNum(featured.total_reads)}
                        </span>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      ادامهٔ مطلب <ArrowLeft className="size-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ) : null}

            <JournalExplorer posts={rest.length > 0 ? rest : posts} />
          </>
        )}
      </section>
    </>
  )
}
