import { formatToman } from "@/lib/money"

export type Product = {
  id: string
  slug: string
  /** Persian display name */
  name: string
  /** Persian maker / house name */
  maker: string
  category: string
  /** Tasting note / short pitch shown on the card (Persian) */
  note: string
  /** Persian origin label */
  origin: string
  abv: number
  volumeMl: number
  /** Price in Toman */
  price: number
  /** Optional strike-through price for "on sale" badges (Toman) */
  compareAt?: number
  rating: number
  reviews: number
  /** Two oklch stops used to paint the bottle/label gradient */
  hue: [string, string]
  /**
   * Optional product photo. Recommended 1000×1250 (4:5 portrait), object-cover.
   * Absent → the card shows a branded gradient placeholder via SmartImage.
   * See public/images/README.md for the full image-size spec.
   */
  image?: string
  badge?: "Limited" | "New" | "Award" | "Rare"
}

/** Persian labels for product badges. */
export const badgeFa: Record<NonNullable<Product["badge"]>, string> = {
  Limited: "محدود",
  New: "جدید",
  Award: "برگزیده",
  Rare: "کمیاب",
}

/** Persian-digit number formatter (groups, digits and decimals localised). */
const faNumberFormatter = new Intl.NumberFormat("fa-IR")

export function faNum(value: number): string {
  return faNumberFormatter.format(value)
}

/**
 * Formats a Toman price with Persian digits, e.g. «۱۸٬۹۰۰٬۰۰۰ تومان».
 *
 * Accepts the exact decimal string the API returns as well as a number — pass the
 * string wherever you have one. This used to be an `Intl.NumberFormat` with
 * `maximumFractionDigits: 0`, which silently rounded every fractional amount
 * (a 125000.50 gift card rendered as ۱۲۵٬۰۰۱ to its owner). See lib/money.ts.
 */
export const formatPrice = formatToman