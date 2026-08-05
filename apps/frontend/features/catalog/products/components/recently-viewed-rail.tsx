"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { History } from "lucide-react"

import { formatPrice } from "@/lib/products"
import { StorefrontMedia } from "@/components/storefront-media"
import {
  recordRecentlyViewed,
  useRecentlyViewed,
  type RecentProduct,
} from "@/lib/recently-viewed"
import { recordInteractionClient } from "@/features/recommendations/client"

/**
 * RecentlyViewedRail — shows the visitor's recently-viewed products (localStorage,
 * works for guests). On a PDP, pass `current` to record this product (and, for
 * signed-in users, log a `view` interaction to warm recommendations); it's then
 * excluded from the rail. Renders nothing until there are ≥2 others, so first
 * visits and SSR show no empty shell.
 */
export function RecentlyViewedRail({
  current,
  currentProductId,
  title = "بازدیدهای اخیر",
  className,
}: {
  current?: RecentProduct
  currentProductId?: number
  title?: string
  className?: string
}) {
  const { status } = useSession()

  React.useEffect(() => {
    if (!current?.slug) return
    recordRecentlyViewed(current)
    // Fire-and-forget interaction (the BFF adds auth; ignored for guests/errors).
    if (currentProductId && status === "authenticated") {
      void recordInteractionClient({
        product_id: currentProductId,
        interaction_type: "view",
        source: "pdp",
      }).catch(() => {})
    }
  }, [current, currentProductId, status])

  const items = useRecentlyViewed(current?.slug)
  if (items.length < 2) return null

  return (
    <section className={className}>
      <p className="eyebrow mb-6">
        <History className="size-3.5" /> {title}
      </p>
      <div className="fade-x -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {items.map((p) => {
          const slug = p.slug?.trim();
          if (!slug) return null;
          return (
            <Link
              key={slug}
              href={`/products/${encodeURIComponent(slug)}`}
              className="group/rv hover-lift border-hairline w-40 shrink-0 overflow-hidden rounded-2xl bg-card sm:w-44"
            >
              <div className="relative aspect-4/5 overflow-hidden">
                <StorefrontMedia
                  slot="recommendation"
                  src={p.image}
                  alt={p.title}
                  monogram={p.title.charAt(0)}
                />
              </div>
              <div className="p-3">
                <p className="line-clamp-1 font-serif text-sm leading-tight transition-colors group-hover/rv:text-primary">
                  {p.title}
                </p>
                {p.price != null ? (
                  <p className="mt-1 font-serif text-sm text-foreground">
                    {formatPrice(p.price)}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  )
}
