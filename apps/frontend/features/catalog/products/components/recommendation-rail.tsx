import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

import { formatPrice } from "@/lib/products";
import { StorefrontMedia } from "@/components/storefront-media";
import { Reveal } from "@/features/motion/components/reveal";
import type { RecommendationItem } from "@/features/recommendations/types";

/**
 * RecommendationRail — a titled product rail backed by the recommendation engine
 * (`RecommendationItem[]`). Server component; renders nothing when empty, so a
 * cold/empty engine simply hides the section. Cards carry real imagery
 * (`image_url`) and link by slug when available.
 */
export function RecommendationRail({
  items,
  title,
  eyebrow,
  icon: Icon,
  className,
}: {
  items: RecommendationItem[];
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <section className={className}>
      <Reveal className="mb-8 flex items-end justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="eyebrow mb-3">
              {Icon ? <Icon className="size-3.5" /> : null} {eyebrow}
            </p>
          ) : null}
          <h2 className="font-serif text-3xl sm:text-4xl">{title}</h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {items.map((item, i) => {
          const slug = item.slug?.trim();
          const href = slug
            ? `/products/${encodeURIComponent(slug)}`
            : undefined;
          const card = (
            <article className="group/rec hover-lift border-hairline shadow-e1 hover:shadow-e3 flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-[box-shadow,border-color] duration-300 hover:ring-primary/25 sm:rounded-3xl">
              <div className="relative aspect-4/5 overflow-hidden">
                <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/rec:scale-105">
                  <StorefrontMedia
                    slot="recommendation"
                    src={item.image_url}
                    alt={item.title}
                    monogram={item.title.charAt(0)}
                  />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/50 to-transparent"
                />
                <span
                  aria-hidden
                  className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover/rec:translate-x-full group-hover/rec:opacity-100 motion-reduce:hidden"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
                {item.brand ? (
                  <span className="truncate text-[11px] font-semibold tracking-wide text-primary sm:text-xs">
                    {item.brand}
                  </span>
                ) : null}
                <h3 className="line-clamp-2 min-h-11 font-serif text-base leading-snug transition-colors group-hover/rec:text-primary sm:text-lg">
                  {item.title}
                </h3>
                <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/40 pt-3">
                  <span className="font-serif text-base text-foreground sm:text-lg">
                    {formatPrice(item.min_price)}
                  </span>
                  {href ? (
                    <span className="inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-semibold text-primary sm:text-sm">
                      مشاهده
                      <ArrowLeft className="size-4 transition-transform group-hover/rec:-translate-x-0.5" />
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          );

          return (
            <Reveal key={item.product_id} delay={Math.min(i, 4) * 0.05} y={20}>
              {href ? (
                <Link
                  href={href}
                  className="block h-full"
                  aria-label={item.title}
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
