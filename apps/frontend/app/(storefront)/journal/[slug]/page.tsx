import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Clock, Eye, ArrowLeft, ShoppingBag, Send } from "lucide-react"

import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/json-ld"
import { breadcrumbLd } from "@/lib/seo/jsonld"
import { absoluteUrl, siteConfig } from "@/lib/site"
import { SmartImage } from "@/components/smart-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BlogCard } from "@/components/journal/blog-card"
import { AddToCartButton } from "@/components/catalog/add-to-cart-button"
import { faNum, formatPrice } from "@/lib/products"
import { getProductById } from "@/lib/catalog/products"
import type { ProductDetail } from "@/lib/catalog/types"
import {
  getBlogBySlug,
  getRelatedBlogs,
  allBlogSlugs,
  formatBlogDate,
  readingTime,
} from "@/lib/journal"

export const revalidate = 3600

export async function generateStaticParams() {
  const slugs = await allBlogSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogBySlug(slug)
  if (!post) return buildMetadata({ title: "نوشته یافت نشد", index: false })
  return buildMetadata({
    title: post.meta_title ?? post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
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
  const post = await getBlogBySlug(slug)
  if (!post) notFound()

  // Hydrate linked products (cap a few) for the "shop this article" upsell, plus
  // pull a few more posts for the read-next rail — concurrently.
  const [products, related] = await Promise.all([
    Promise.all((post.product_ids ?? []).slice(0, 4).map((id) => getProductById(id))).then((list) =>
      list.filter((p): p is ProductDetail => Boolean(p))
    ),
    getRelatedBlogs(slug, 3),
  ])

  const url = absoluteUrl(`/journal/${post.slug}`)
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    inLanguage: "fa-IR",
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    url,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
  }

  const shareText = encodeURIComponent(post.title)

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

      {/* Hero */}
      <header className="cellar-glow border-b border-border/60">
        <div className="container-px mx-auto max-w-3xl py-14 sm:py-16 text-center">
          <nav className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">خانه</Link>
            <span aria-hidden>/</span>
            <Link href="/journal" className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">ژورنال</Link>
          </nav>

          {post.categories.length > 0 ? (
            <div className="mb-5 flex flex-wrap justify-center gap-2">
              {post.categories.map((c) => (
                <Badge key={c.id} variant="secondary">{c.name}</Badge>
              ))}
            </div>
          ) : null}

          <h1 className="text-balance font-serif text-4xl leading-[1.1] sm:text-5xl">{post.title}</h1>

          {post.excerpt ? (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {post.published_at ? <span>{formatBlogDate(post.published_at)}</span> : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {readingTime(post.time_to_read)}
            </span>
            {post.total_reads > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-4" /> {faNum(post.total_reads)} بازدید
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Cover */}
      <div className="container-px mx-auto max-w-4xl pt-12">
        <div className="border-hairline relative aspect-[16/9] overflow-hidden rounded-[2rem] ring-1 ring-foreground/10">
          <SmartImage
            src={null}
            alt={post.title}
            monogram={post.title.charAt(0)}
            fallbackClassName="from-primary/20 via-card to-secondary"
            priority
          />
        </div>
      </div>

      {/* Body */}
      <article className="container-px mx-auto max-w-3xl py-14 sm:py-16">
        <div className="space-y-6 text-lg leading-9 text-foreground/85 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-8 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/50 [&_blockquote]:ps-6 [&_blockquote]:font-serif [&_blockquote]:text-2xl [&_blockquote]:leading-relaxed [&_blockquote]:text-foreground [&_h2]:mt-12 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-foreground [&_h3]:mt-10 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:text-foreground [&_img]:my-8 [&_img]:rounded-2xl [&_img]:ring-1 [&_img]:ring-foreground/10 [&_li]:mt-2 [&_li]:leading-relaxed [&_li]:marker:text-primary [&_ol]:list-decimal [&_ol]:ps-6 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>

        {/* Share */}
        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-border/60 pt-8">
          <span className="text-sm font-medium">هم‌رسانی:</span>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send className="size-4" /> تلگرام
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              ایکس (توییتر)
            </a>
          </Button>
        </div>
      </article>

      {/* Shop this article */}
      {products.length > 0 ? (
        <section className="border-t border-border/60 bg-card/30">
          <div className="container-px mx-auto max-w-5xl py-16 sm:py-20">
            <p className="eyebrow mb-2">
              <ShoppingBag className="size-3.5" /> از این نوشته
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl">محصولات مرتبط</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {products.map((p) => (
                <ArticleProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Read next */}
      {related.length > 0 ? (
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
              <ArrowLeft className="size-4 transition-transform duration-300 group-hover/all:-translate-x-1" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {related.map((p, i) => (
              <BlogCard key={p.id} post={p} index={i} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}

function ArticleProductCard({ product }: { product: ProductDetail }) {
  const activeVariants = (product.variants ?? []).filter((v) => v.is_active)
  const cheapest = activeVariants
    .slice()
    .sort((a, b) => a.price - b.price)[0]
  const image = (product.images ?? []).find((i) => i.is_primary) ?? product.images?.[0]
  const onSale =
    cheapest?.compare_at_price != null && cheapest.compare_at_price > cheapest.price
  const pdp = `/products/${product.slug}`

  return (
    <article className="border-hairline flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-foreground/5">
      <Link href={pdp} className="relative block aspect-square overflow-hidden rounded-2xl">
        <SmartImage
          src={image?.image_url}
          alt={image?.alt_text ?? product.title}
          sizes="(max-width: 640px) 100vw, 33vw"
          monogram={product.title.charAt(0)}
        />
      </Link>
      <div className="flex flex-1 flex-col">
        <h3 className="font-serif text-lg leading-tight">
          <Link href={pdp}>{product.title}</Link>
        </h3>
        {cheapest ? (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-xl">{formatPrice(cheapest.price)}</span>
            {onSale ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(cheapest.compare_at_price!)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4">
          {cheapest ? (
            <AddToCartButton productVariantId={cheapest.id} />
          ) : (
            <Button variant="outline" asChild className="h-12 w-full">
              <Link href={pdp}>مشاهدهٔ محصول</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
