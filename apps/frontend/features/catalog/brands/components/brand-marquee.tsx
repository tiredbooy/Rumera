import Link from "next/link";

import type { FeaturedBrand } from "@/features/catalog/brands/api";
import { productListBrandHref } from "@/features/catalog/products/list-routing";
import { cn } from "@/lib/utils";

/**
 * Infinite, dependency-free brand marquee. Renders the items twice inside a
 * track that loops via a CSS keyframe (see globals.css). Real brands deep-link
 * to the catalogue; title-only fallbacks stay non-interactive.
 */
export function BrandMarquee({
  items,
  className,
  duration = "38s",
}: {
  items: FeaturedBrand[];
  className?: string;
  duration?: string;
}) {
  // Duplicate the list so the -50% translate wraps seamlessly.
  const track = [...items, ...items];

  return (
    <div
      className={cn("group/marquee fade-x relative overflow-hidden", className)}
    >
      <div
        className="animate-marquee flex w-max items-center gap-10 whitespace-nowrap will-change-transform sm:gap-12"
        style={{ ["--marquee-duration" as string]: duration }}
      >
        {track.map((item, i) => {
          const isDuplicate = i >= items.length;
          const label = (
            <span
              className={cn(
                "font-serif text-lg tracking-wide text-muted-foreground/70 transition-colors",
                item.slug && "hover:text-foreground",
              )}
            >
              {item.title}
            </span>
          );

          if (!item.slug) {
            return (
              <span key={`${item.title}-${i}`} aria-hidden={isDuplicate}>
                {label}
              </span>
            );
          }

          return (
            <Link
              key={`${item.id}-${i}`}
              href={productListBrandHref(item.slug)}
              aria-hidden={isDuplicate}
              tabIndex={isDuplicate ? -1 : undefined}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
