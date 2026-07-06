/**
 * Maps a category slug to a small glyph for the home category cards' corner
 * chip. Decoupled from the data source so categories can be added in the admin
 * dashboard without touching the home page — unknown slugs get a sensible
 * default instead of crashing.
 */
import {
  FaWineGlass,
  FaGlassWhiskey,
  FaBeer,
  FaCocktail,
  FaGlassCheers,
  FaWineBottle,
  FaFlask,
} from "react-icons/fa";
import { IoSparkles, IoWine, IoBeer, IoCafe } from "react-icons/io5";

import type { IconType } from "react-icons";

const ICON_BY_SLUG: Record<string, IconType> = {
  // ---- Whiskies ----
  whisky: FaGlassWhiskey,
  whiskey: FaGlassWhiskey,
  scotch: FaGlassWhiskey,
  bourbon: FaGlassWhiskey,
  rye: FaGlassWhiskey,

  // ---- Wines ----
  wine: FaWineGlass,
  red: FaWineGlass,
  white: FaWineGlass,
  rose: IoWine, // Ionicons has a nice rose icon
  rosé: IoWine,

  // ---- Sparkling ----
  champagne: IoSparkles,
  prosecco: IoSparkles,
  sparkling: IoSparkles,

  // ---- Spirits ----
  gin: FaFlask,
  vodka: FaFlask,
  tequila: FaFlask,
  mezcal: FaFlask,

  // ---- Rums & Brandies ----
  rum: FaWineBottle,
  brandy: FaWineBottle,
  cognac: FaWineBottle,

  // ---- Beers & Ciders ----
  beer: FaBeer,
  ale: FaBeer,
  lager: FaBeer,
  stout: FaBeer,
  pilsner: FaBeer,
  cider: FaGlassCheers, // or use a custom one

  // ---- Cocktails & Liqueurs ----
  cocktail: FaCocktail,
  mocktail: FaCocktail,
  liqueur: IoCafe, // just a placeholder, you can pick any
  schnapps: IoCafe,

  // ---- Other ----
  sake: FaWineGlass,
  soju: FaWineGlass,
};

export function categoryIconFor(slug: string): IconType {
  return ICON_BY_SLUG[slug?.toLowerCase()] ?? FaGlassCheers;
}
