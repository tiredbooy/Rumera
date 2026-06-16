import type { Metadata } from "next"
import { BookOpen } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { Reveal } from "@/components/motion/reveal"
import { JournalExplorer } from "@/components/journal/journal-explorer"
import { BlogCard } from "@/components/journal/blog-card"
import { listBlogs } from "@/lib/journal"

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
      <section className="cellar-glow relative overflow-hidden border-b border-border/60">
        <div className="container-px mx-auto max-w-7xl py-16 sm:py-20 lg:py-24">
          <Reveal>
            <p className="eyebrow mb-4">
              <BookOpen className="size-3.5" /> ژورنال رومرا
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

      <section className="container-px mx-auto max-w-7xl py-12 sm:py-16">
        {posts.length === 0 ? (
          <div className="border-hairline flex flex-col items-center gap-3 rounded-3xl bg-card/50 px-6 py-24 text-center ring-1 ring-foreground/5">
            <BookOpen className="size-10 text-muted-foreground/50" />
            <p className="font-serif text-2xl">به‌زودی</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              هنوز نوشته‌ای منتشر نشده است. به‌زودی سر بزنید.
            </p>
          </div>
        ) : (
          <>
            {/* Featured (latest) — wide editorial lead */}
            {featured ? (
              <Reveal className="mb-12 sm:mb-16">
                <BlogCard post={featured} featured />
              </Reveal>
            ) : null}

            <JournalExplorer posts={rest.length > 0 ? rest : posts} />
          </>
        )}
      </section>
    </>
  )
}
