/**
 * Maps a category slug to a small glyph for the home category cards' corner
 * chip. Decoupled from the data source so categories can be added in the admin
 * dashboard without touching the home page — unknown slugs get a sensible
 * default instead of crashing.
 */
import { Wine, Sparkles, Martini, GlassWater, Grape, type LucideIcon } from "lucide-react"

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  whisky: GlassWater,
  whiskey: GlassWater,
  wine: Wine,
  champagne: Sparkles,
  gin: Martini,
  rum: GlassWater,
  tequila: Martini,
  vodka: Grape,
}

export function categoryIconFor(slug: string): LucideIcon {
  return ICON_BY_SLUG[slug?.toLowerCase()] ?? GlassWater
}
