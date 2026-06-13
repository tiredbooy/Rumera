import type { Metadata } from "next"
import Link from "next/link"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { journalPosts } from "@/lib/journal"
import { faNum } from "@/lib/products"
import { Reveal } from "@/components/motion/reveal"

export const revalidate = 86400

export const metadata: Metadata = buildMetadata({
  title: "ژورنال",
  description: "یادداشت‌ها، راهنماها و داستان‌هایی از دنیای اسپیریت، شراب و شامپاین.",
  path: "/journal",
})

export default function JournalPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "خانه", path: "/" },
          { name: "ژورنال", path: "/journal" },
        ])}
      />

      <section className="container-px mx-auto max-w-5xl py-14">
        <Reveal>
          <p className="eyebrow mb-3">یادداشت‌ها</p>
          <h1 className="font-serif text-5xl">ژورنال رومرا</h1>
        </Reveal>

        <div className="mt-10 divide-y divide-border/60">
          {journalPosts.map((post, i) => (
            <Reveal key={post.slug} delay={Math.min(i, 4) * 0.05}>
              <Link
                href={`/journal/${post.slug}`}
                className="group/post flex flex-col gap-2 py-7 transition-colors"
              >
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-primary">{post.category}</span>
                  <span>·</span>
                  <span>{faNum(post.readingMinutes)} دقیقه مطالعه</span>
                </div>
                <h2 className="font-serif text-2xl transition-colors group-hover/post:text-primary">
                  {post.title}
                </h2>
                <p className="text-muted-foreground">{post.excerpt}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
