import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { absoluteUrl, siteConfig } from "@/lib/site"
import { journalPosts, getPost } from "@/lib/journal"
import { faNum } from "@/lib/products"

export const revalidate = 86400

export function generateStaticParams() {
  return journalPosts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return buildMetadata({ title: "نوشته یافت نشد", index: false })
  return buildMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/journal/${post.slug}`,
    type: "article",
  })
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    inLanguage: "fa-IR",
    datePublished: post.date,
    url: absoluteUrl(`/journal/${post.slug}`),
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
  }

  return (
    <>
      <JsonLd
        data={[
          articleLd,
          breadcrumbLd([
            { name: "خانه", path: "/" },
            { name: "ژورنال", path: "/journal" },
            { name: post.title, path: `/journal/${post.slug}` },
          ]),
        ]}
      />

      <article className="container-px mx-auto max-w-2xl py-16">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">خانه</Link>
          <span>/</span>
          <Link href="/journal" className="hover:text-foreground">ژورنال</Link>
        </nav>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-primary">{post.category}</span>
          <span>·</span>
          <span>{faNum(post.readingMinutes)} دقیقه مطالعه</span>
        </div>
        <h1 className="mt-3 font-serif text-5xl leading-tight">{post.title}</h1>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
          {post.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>
    </>
  )
}
