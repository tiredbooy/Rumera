import Link from "next/link";
import { Clock, ArrowLeft, Eye } from "lucide-react";

import { cn } from "@/lib/utils";
import { faNum } from "@/lib/products";
import { SmartImage } from "@/components/smart-image";
import type { JournalListItem } from "@/features/journal/types";
import { formatJournalDate, formatReadingTime } from "@/features/journal/utils";

// Rotated placeholder tints so an occasional cover-less post still feels
// editorial (SmartImage uses these as its gradient fallback).
const tints = [
  "from-accent/60 via-card to-secondary",
  "from-primary/15 via-card to-secondary",
  "from-wine/15 via-card to-secondary",
  "from-secondary via-card to-accent/60",
];

function tint(index: number): string {
  return tints[index % tints.length];
}

/**
 * JournalCard — magazine-style card for the journal grid.
 *
 * Renders the post cover via `next/image` (`image_url`) with a graceful, branded
 * gradient fallback when the cover is missing. The `featured` variant is a wide
 * editorial split (large cover beside copy) for the lead story; the default is
 * the standard grid card with hover elevation. Stable accessible names + a
 * `data-journal-card` hook make it easy to target for tests/automation.
 */
export function JournalCard({
  post,
  index = 0,
  featured = false,
  priority = false,
}: {
  post: JournalListItem;
  index?: number;
  featured?: boolean;
  /** Pass for above-the-fold cards (e.g. the featured lead) to prioritize the cover. */
  priority?: boolean;
}) {
  const href = `/journal/${post.slug}`;

  if (featured) {
    return (
      <article
        data-journal-card="featured"
        className="group/feat border-hairline shadow-e1 hover:shadow-e3 relative grid overflow-hidden rounded-[1.5rem] bg-card ring-1 ring-foreground/5 transition-[box-shadow,border-color] duration-300 hover:ring-primary/30 sm:rounded-[2rem] lg:grid-cols-2"
      >
        <Link
          href={href}
          className="relative block focus-visible:outline-none"
          aria-label={post.title}
        >
          <div className="relative aspect-[16/10] overflow-hidden lg:h-full lg:aspect-auto">
            <SmartImage
              src={post.image_url}
              alt={post.image_alt?.trim() || post.title}
              monogram={post.title.charAt(0)}
              fallbackClassName={cn("bg-gradient-to-br", tint(index))}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority={priority}
              className="transition-transform duration-500 ease-cellar group-hover/feat:scale-[1.03]"
            />
            <span className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-background/75 px-2.5 py-1 text-xs font-medium text-foreground shadow-e1 backdrop-blur-sm">
              <Clock className="size-3.5" aria-hidden />{" "}
              {formatReadingTime(post.time_to_read)}
            </span>
          </div>
        </Link>

        <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
          <span className="eyebrow">نوشتهٔ منتخب</span>
          <h2 className="font-serif text-3xl leading-tight transition-colors group-hover/feat:text-primary sm:text-4xl">
            <Link
              href={href}
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {post.title}
            </Link>
          </h2>
          {post.excerpt ? (
            <p className="line-clamp-3 leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {post.published_at ? (
              <span>{formatJournalDate(post.published_at)}</span>
            ) : null}
            {post.total_reads > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" aria-hidden />{" "}
                {faNum(post.total_reads)} بازدید
              </span>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            ادامهٔ مطلب
            <ArrowLeft
              className="size-4 transition-transform duration-300 group-hover/feat:-translate-x-1"
              aria-hidden
            />
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      data-journal-card="default"
      className="group/post press border-hairline shadow-e1 hover:shadow-e3 relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 ease-cellar hover:-translate-y-1 hover:ring-primary/30 sm:rounded-3xl"
    >
      <Link
        href={href}
        className="relative block focus-visible:outline-none"
        aria-label={post.title}
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <SmartImage
            src={post.image_url}
            alt={post.image_alt?.trim() || post.title}
            monogram={post.title.charAt(0)}
            fallbackClassName={cn("bg-gradient-to-br", tint(index))}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={priority}
            className="transition-transform duration-500 ease-cellar group-hover/post:scale-105"
          />
          <span className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-background/75 px-2.5 py-1 text-xs font-medium text-foreground shadow-e1 backdrop-blur-sm">
            <Clock className="size-3.5" aria-hidden />{" "}
            {formatReadingTime(post.time_to_read)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.published_at ? (
            <span>{formatJournalDate(post.published_at)}</span>
          ) : null}
          {post.total_reads > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5" aria-hidden /> {faNum(post.total_reads)}
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-serif text-xl leading-snug transition-colors group-hover/post:text-primary sm:text-2xl">
          <Link
            href={href}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary">
          ادامهٔ مطلب
          <ArrowLeft
            className="size-4 transition-transform duration-300 group-hover/post:-translate-x-1"
            aria-hidden
          />
        </span>
      </div>
    </article>
  );
}
