import { cn } from "@/lib/utils"

/** Neutral fallback gradient for products that don't carry their own hue (live API data). */
const DEFAULT_HUE: [string, string] = ["oklch(0.62 0.13 65)", "oklch(0.32 0.08 50)"]

/**
 * Dependency-free bottle visual: an SVG silhouette filled with a gradient and a
 * foil label. Looks intentional and luxe without shipping any product
 * photography, and never renders a broken image. `hue` is optional so it works
 * with both the sample data (which carries a hue) and live API products.
 */
export function Bottle({
  product,
  className,
}: {
  product: { id: string | number; hue?: [string, string]; maker?: string }
  className?: string
}) {
  const gradientId = `bottle-${product.id}`
  const [from, to] = product.hue ?? DEFAULT_HUE

  return (
    <svg
      viewBox="0 0 120 280"
      className={cn("h-full w-auto drop-shadow-xl", className)}
      role="img"
      aria-label={product.maker ? `بطری ${product.maker}` : "بطری رومرا"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${gradientId}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="42%" stopColor="white" stopOpacity="0.35" />
          <stop offset="55%" stopColor="white" stopOpacity="0.05" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Bottle silhouette: neck → shoulder → body */}
      <path
        d="M50 8 h20 v26 c0 6 4 9 8 14 c6 7 10 14 10 28 v168 c0 9 -6 16 -16 16 H58 c-10 0 -16 -7 -16 -16 V76 c0 -14 4 -21 10 -28 c4 -5 8 -8 8 -14 V8 Z"
        fill={`url(#${gradientId})`}
      />
      {/* Glass highlight */}
      <path
        d="M50 8 h20 v26 c0 6 4 9 8 14 c6 7 10 14 10 28 v168 c0 9 -6 16 -16 16 H58 c-10 0 -16 -7 -16 -16 V76 c0 -14 4 -21 10 -28 c4 -5 8 -8 8 -14 V8 Z"
        fill={`url(#${gradientId}-shine)`}
      />
      {/* Foil capsule */}
      <rect x="48" y="6" width="24" height="14" rx="2" fill="var(--gold)" />
      {/* Label */}
      <rect
        x="44"
        y="150"
        width="32"
        height="62"
        rx="3"
        fill="oklch(0.97 0.02 85)"
        opacity="0.95"
      />
      <rect x="50" y="160" width="20" height="2.5" rx="1.25" fill="var(--wine)" />
      <rect x="52" y="172" width="16" height="1.6" rx="0.8" fill="oklch(0.4 0.02 60)" />
      <rect x="52" y="178" width="16" height="1.6" rx="0.8" fill="oklch(0.4 0.02 60)" />
      <rect x="54" y="196" width="12" height="2" rx="1" fill="var(--gold)" />
    </svg>
  )
}
