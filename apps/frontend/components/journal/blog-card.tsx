import Link from "next/link"
import { Clock, ArrowLeft, Eye } from "lucide-react"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import { formatBlogDate, readingTime, type BlogPost } from "@/lib/journal"

// Rotated placeholder tints so a grid of image-less posts still feels editorial.
const tints = [
  "from-accent/60 via-card to-secondary",
  "from-primary/15 via-card to-secondary",
  "from-wine/15 via-card to-secondary",
  "from-secondary via-card to-accent/60",
]

/**
 * BlogCard — magazine-style journal card. Posts carry no cover image, so the
 * media area is a branded gradient panel with a large foil monogram (more
 * editorial than a generic placeholder) plus an overlaid reading-time pill.
 *
 * The `featured` variant renders a wide editorial split (image beside copy) for
 * the lead story on the journal index; the default is the standard grid card.
 */
export function BlogCard({
  post,
  index = 0,
  featured = false,
}: {
  post: BlogPost
  index?: number
  featured?: boolean
}) {
  const href = `/journal/${post.slug}`

  if (featured) {
    return (
      <article className="group/feat border-hairline relative grid overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:shadow-2xl hover:shadow-foreground/10 hover:ring-primary/30 sm:rounded-[2rem] lg:grid-cols-2">
        <Link href={href} className="relative block" aria-label={post.title}>
          <div
            className={cn(
              "relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br lg:h-full",
              tints[index % tints.length]
            )}
          >
            <div className="cellar-glow absolute inset-0 opacity-70" />
            <span
              aria-hidden
              className="text-foil relative font-serif text-7xl transition-transform duration-500 group-hover/feat:scale-105 sm:text-8xl"
            >
              {post.title.charAt(0)}
            </span>
          </div>
        </Link>

        <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
          <span className="eyebrow">نوشتهٔ منتخب</span>
          <h2 className="font-serif text-3xl leading-tight transition-colors group-hover/feat:text-primary sm:text-4xl">
            <Link href={href}>{post.title}</Link>
          </h2>
          {post.excerpt ? (
            <p className="line-clamp-3 leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {post.published_at ? <span>{formatBlogDate(post.published_at)}</span> : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> {readingTime(post.time_to_read)}
            </span>
            {post.total_reads > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" /> {faNum(post.total_reads)}
              </span>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            ادامهٔ مطلب
            <ArrowLeft className="size-4 transition-transform duration-300 group-hover/feat:-translate-x-1" />
          </span>
        </div>
      </article>
    )
  }

  return (
    <article className="group/post border-hairline relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:shadow-2xl hover:shadow-foreground/10 hover:ring-primary/30 sm:rounded-3xl">
      <Link href={href} className="relative block" aria-label={post.title}>
        <div
          className={cn(
            "relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br",
            tints[index % tints.length]
          )}
        >
          <div className="cellar-glow absolute inset-0 opacity-70" />
          <span
            aria-hidden
            className="text-foil relative font-serif text-6xl transition-transform duration-500 group-hover/post:scale-110 sm:text-7xl"
          >
            {post.title.charAt(0)}
          </span>
          <span className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-background/75 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            <Clock className="size-3.5" /> {readingTime(post.time_to_read)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.published_at ? <span>{formatBlogDate(post.published_at)}</span> : null}
          {post.total_reads > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5" /> {faNum(post.total_reads)}
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-serif text-xl leading-snug transition-colors group-hover/post:text-primary sm:text-2xl">
          <Link href={href}>{post.title}</Link>
        </h3>

        {post.excerpt ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary">
          ادامهٔ مطلب
          <ArrowLeft className="size-4 transition-transform duration-300 group-hover/post:-translate-x-1" />
        </span>
      </div>
    </article>
  )
}
