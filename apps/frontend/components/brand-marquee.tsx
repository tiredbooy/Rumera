import { cn } from "@/lib/utils"

/**
 * Infinite, dependency-free logo/brand marquee. Renders the items twice inside
 * a track that loops via a CSS keyframe (see globals.css). Pure server
 * component — no client JS, no layout thrash; it animates on the compositor and
 * pauses on hover.
 */
export function BrandMarquee({
  items,
  className,
  duration = "38s",
}: {
  items: string[]
  className?: string
  duration?: string
}) {
  // Duplicate the list so the -50% translate wraps seamlessly.
  const track = [...items, ...items]

  return (
    <div className={cn("group/marquee fade-x relative overflow-hidden", className)}>
      <div
        className="animate-marquee flex w-max items-center gap-12 whitespace-nowrap will-change-transform"
        style={{ ["--marquee-duration" as string]: duration }}
      >
        {track.map((item, i) => (
          <span
            key={`${item}-${i}`}
            aria-hidden={i >= items.length}
            className="font-serif text-lg tracking-wide text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
