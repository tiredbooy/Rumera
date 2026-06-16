import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"

import { formatPrice } from "@/lib/products"
import { SmartImage } from "@/components/smart-image"
import { Reveal } from "@/components/motion/reveal"
import type { RecommendationItem } from "@/lib/catalog/recommendations"

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
  items: RecommendationItem[]
  title: string
  eyebrow?: string
  icon?: LucideIcon
  className?: string
}) {
  if (!items.length) return null

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
          const href = item.slug ? `/products/${item.slug}` : undefined
          const card = (
            <article className="group/rec hover-lift border-hairline flex h-full flex-col overflow-hidden rounded-2xl bg-card sm:rounded-3xl">
              <div className="relative aspect-4/5 overflow-hidden">
                <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/rec:scale-105">
                  <SmartImage
                    src={item.image_url}
                    alt={item.title}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    monogram={item.title.charAt(0)}
                    label={item.brand}
                    fallbackClassName="from-accent/40 via-card to-secondary"
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
                {item.brand ? (
                  <span className="truncate text-[11px] font-medium text-primary sm:text-xs">
                    {item.brand}
                  </span>
                ) : null}
                <h3 className="line-clamp-2 font-serif text-base leading-tight transition-colors group-hover/rec:text-primary sm:text-lg">
                  {item.title}
                </h3>
                <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
                  <span className="font-serif text-base text-foreground sm:text-lg">
                    {formatPrice(item.min_price)}
                  </span>
                  {href ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover/rec:opacity-100 sm:text-sm">
                      مشاهده <ArrowLeft className="size-4 transition-transform group-hover/rec:-translate-x-0.5" />
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          )

          return (
            <Reveal key={item.product_id} delay={Math.min(i, 4) * 0.05} y={20}>
              {href ? (
                <Link href={href} className="block h-full" aria-label={item.title}>
                  {card}
                </Link>
              ) : (
                card
              )}
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
