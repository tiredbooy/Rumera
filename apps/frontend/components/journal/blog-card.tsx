import Link from "next/link"
import { Clock, ArrowLeft, Eye } from "lucide-react"

import { SmartImage } from "@/components/smart-image"
import { faNum } from "@/lib/products"
import { formatBlogDate, readingTime, type BlogPost } from "@/lib/journal"

// Rotated placeholder tints so a grid of image-less posts still feels editorial.
const tints = [
  "from-accent/50 via-card to-secondary",
  "from-primary/15 via-card to-secondary",
  "from-wine/15 via-card to-secondary",
  "from-secondary via-card to-accent/50",
]

/**
 * BlogCard — magazine-style journal card. Blogs carry no cover image, so the
 * media area uses SmartImage's branded placeholder (varied per card).
 */
export function BlogCard({ post, index = 0 }: { post: BlogPost; index?: number }) {
  const href = `/journal/${post.slug}`

  return (
    <article className="group/post border-hairline relative flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-foreground/5 hover:ring-primary/30">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Link href={href} className="absolute inset-0" aria-label={post.title}>
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/post:scale-105">
            <SmartImage
              src={null}
              alt={post.title}
              monogram={post.title.charAt(0)}
              fallbackClassName={tints[index % tints.length]}
            />
          </div>
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.published_at ? <span>{formatBlogDate(post.published_at)}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {readingTime(post.time_to_read)}
          </span>
          {post.total_reads > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" /> {faNum(post.total_reads)}
            </span>
          ) : null}
        </div>

        <h3 className="font-serif text-2xl leading-tight transition-colors group-hover/post:text-primary">
          <Link href={href}>{post.title}</Link>
        </h3>

        {post.excerpt ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          ادامهٔ مطلب
          <ArrowLeft className="size-4 transition-transform group-hover/post:-translate-x-1" />
        </span>
      </div>
    </article>
  )
}
