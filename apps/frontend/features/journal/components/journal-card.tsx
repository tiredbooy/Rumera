import Link from "next/link";
import { ArrowLeft, Clock, Eye, Pin } from "lucide-react";

import { StorefrontMedia } from "@/components/storefront-media";
import type { JournalListItem } from "@/features/journal/types";
import { formatJournalDate, formatReadingTime } from "@/features/journal/utils";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

const tints = [
  "from-accent/60 via-card to-secondary",
  "from-primary/15 via-card to-secondary",
  "from-wine/15 via-card to-secondary",
  "from-secondary via-card to-accent/60",
];

function tint(index: number): string {
  return tints[index % tints.length];
}

export function JournalCard({
  post,
  index = 0,
  featured = false,
  featuredLabel = "نوشتهٔ منتخب",
  priority = false,
  headingLevel = 2,
}: {
  post: JournalListItem;
  index?: number;
  featured?: boolean;
  featuredLabel?: string;
  priority?: boolean;
  headingLevel?: 2 | 3;
}) {
  const href = `/journal/${encodeURIComponent(post.slug)}`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  if (featured) {
    return (
      <article data-journal-card="featured">
        <Link
          href={href}
          className="group/feat relative grid overflow-hidden rounded-[1.5rem] bg-card shadow-e1 ring-1 ring-primary/15 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-e2 hover:ring-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 sm:rounded-[1.75rem] lg:grid-cols-2"
        >
          {/* Editorial gold edge — marks the pin without loud glow */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 z-20 w-1 bg-gradient-to-b from-gold via-primary to-gold/70 lg:w-1.5"
          />
          <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[18rem] lg:h-full">
            <StorefrontMedia
              slot="journal-hero"
              src={post.image_url}
              alt={post.image_alt?.trim() || post.title}
              monogram={post.title.charAt(0)}
              fallbackClassName={cn("bg-gradient-to-br", tint(index))}
              priority={priority}
              className="transition-transform duration-500 ease-cellar group-hover/feat:scale-[1.03]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent lg:bg-gradient-to-l lg:from-background/50 lg:via-transparent"
            />
            <span className="absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-background/90 px-2.5 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm">
              <Pin className="size-3.5 fill-primary/20" aria-hidden="true" />
              {featuredLabel}
            </span>
            <span className="absolute bottom-3 end-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatReadingTime(post.time_to_read)}
            </span>
          </div>

          <div className="relative flex flex-col justify-center gap-4 border-t border-border/40 p-6 sm:p-9 lg:border-s lg:border-t-0 lg:ps-10">
            <Heading className="font-serif text-3xl leading-tight transition-colors group-hover/feat:text-primary sm:text-4xl">
              {post.title}
            </Heading>
            {post.excerpt ? (
              <p className="line-clamp-3 leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {post.published_at ? (
                <time dateTime={post.published_at}>
                  {formatJournalDate(post.published_at)}
                </time>
              ) : null}
              {post.total_reads > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-3.5" aria-hidden="true" />
                  {faNum(post.total_reads)} بازدید
                </span>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              ادامهٔ مطلب
              <ArrowLeft
                className="size-4 transition-transform duration-300 group-hover/feat:-translate-x-1"
                aria-hidden="true"
              />
            </span>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article data-journal-card="default" className="h-full">
      <Link
        href={href}
        className="group/post press hover-lift border-hairline shadow-e1 relative flex h-full flex-col overflow-hidden rounded-2xl bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 sm:rounded-3xl"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <StorefrontMedia
            slot="journal-card"
            src={post.image_url}
            alt={post.image_alt?.trim() || post.title}
            monogram={post.title.charAt(0)}
            fallbackClassName={cn("bg-gradient-to-br", tint(index))}
            priority={priority}
            className="transition-transform duration-500 ease-cellar group-hover/post:scale-105"
          />
          <span className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-e1 backdrop-blur-sm">
            <Clock className="size-3.5" aria-hidden="true" />
            {formatReadingTime(post.time_to_read)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {post.published_at ? (
              <time dateTime={post.published_at}>
                {formatJournalDate(post.published_at)}
              </time>
            ) : null}
            {post.total_reads > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" aria-hidden="true" />
                {faNum(post.total_reads)} بازدید
              </span>
            ) : null}
          </div>

          <Heading className="line-clamp-2 font-serif text-xl leading-snug transition-colors group-hover/post:text-primary sm:text-2xl">
            {post.title}
          </Heading>
          {post.excerpt ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          ) : null}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary">
            ادامهٔ مطلب
            <ArrowLeft
              className="size-4 transition-transform duration-300 group-hover/post:-translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}
