export type Category =
  | "Whisky"
  | "Wine"
  | "Champagne"
  | "Gin"
  | "Rum"
  | "Tequila"
  | "Vodka"

export type Product = {
  id: string
  slug: string
  name: string
  maker: string
  category: Category
  /** Tasting note / short pitch shown on the card */
  note: string
  origin: string
  abv: number
  volumeMl: number
  price: number
  /** Optional strike-through price for "on sale" badges */
  compareAt?: number
  rating: number
  reviews: number
  /** Two oklch stops used to paint the bottle/label gradient */
  hue: [string, string]
  badge?: "Limited" | "New" | "Award" | "Rare"
}

/** Brand-consistent gradient pairs keyed loosely to the liquid's color. */
const HUES: Record<Category, [string, string]> = {
  Whisky: ["oklch(0.62 0.13 65)", "oklch(0.32 0.08 50)"],
  Wine: ["oklch(0.45 0.16 18)", "oklch(0.24 0.08 20)"],
  Champagne: ["oklch(0.82 0.1 95)", "oklch(0.55 0.09 80)"],
  Gin: ["oklch(0.7 0.11 200)", "oklch(0.4 0.08 220)"],
  Rum: ["oklch(0.55 0.13 55)", "oklch(0.3 0.07 45)"],
  Tequila: ["oklch(0.78 0.12 110)", "oklch(0.5 0.1 120)"],
  Vodka: ["oklch(0.8 0.03 230)", "oklch(0.55 0.04 250)"],
}

function make(
  p: Omit<Product, "slug" | "hue"> & { hue?: [string, string] }
): Product {
  return {
    ...p,
    slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    hue: p.hue ?? HUES[p.category],
  }
}

export const products: Product[] = [
  make({
    id: "1",
    name: "Aobane 18 Year",
    maker: "Aobane Distillery",
    category: "Whisky",
    note: "Single malt aged in sherry casks — dried fig, toffee, a whisper of sea salt.",
    origin: "Islay, Scotland",
    abv: 46,
    volumeMl: 700,
    price: 189,
    rating: 4.9,
    reviews: 214,
    badge: "Award",
  }),
  make({
    id: "2",
    name: "Maison Velour Brut",
    maker: "Maison Velour",
    category: "Champagne",
    note: "Grower champagne with a fine, persistent mousse — brioche, white peach, citrus zest.",
    origin: "Reims, France",
    abv: 12,
    volumeMl: 750,
    price: 84,
    compareAt: 99,
    rating: 4.8,
    reviews: 132,
    badge: "New",
  }),
  make({
    id: "3",
    name: "Château Noir 2016",
    maker: "Château Noir",
    category: "Wine",
    note: "A brooding Bordeaux blend — blackcurrant, cedar, graphite and velvet tannins.",
    origin: "Pauillac, France",
    abv: 14,
    volumeMl: 750,
    price: 142,
    rating: 4.7,
    reviews: 98,
    badge: "Limited",
  }),
  make({
    id: "4",
    name: "Botanic No. 7",
    maker: "Harrow & Vale",
    category: "Gin",
    note: "Small-batch London Dry — juniper forward with coriander, grapefruit peel and elderflower.",
    origin: "London, England",
    abv: 43,
    volumeMl: 700,
    price: 48,
    rating: 4.6,
    reviews: 176,
  }),
  make({
    id: "5",
    name: "Isla Vieja Añejo",
    maker: "Isla Vieja",
    category: "Rum",
    note: "Twelve years in oak — banana bread, burnt sugar, baking spice and a long warm finish.",
    origin: "Bridgetown, Barbados",
    abv: 40,
    volumeMl: 700,
    price: 72,
    rating: 4.8,
    reviews: 143,
    badge: "Rare",
  }),
  make({
    id: "6",
    name: "Sol de Agave Blanco",
    maker: "Sol de Agave",
    category: "Tequila",
    note: "Additive-free highland tequila — cooked agave, green apple, white pepper and citrus.",
    origin: "Jalisco, Mexico",
    abv: 40,
    volumeMl: 750,
    price: 59,
    rating: 4.7,
    reviews: 121,
    badge: "New",
  }),
  make({
    id: "7",
    name: "Polar Crystal",
    maker: "Polar Crystal",
    category: "Vodka",
    note: "Seven-times distilled from winter wheat — clean, silky, with a faint cracked-pepper finish.",
    origin: "Mazovia, Poland",
    abv: 40,
    volumeMl: 700,
    price: 38,
    rating: 4.5,
    reviews: 89,
  }),
  make({
    id: "8",
    name: "Aobane Cask Strength",
    maker: "Aobane Distillery",
    category: "Whisky",
    note: "Bottled at full strength — bonfire smoke, dark chocolate and orange marmalade.",
    origin: "Islay, Scotland",
    abv: 58.4,
    volumeMl: 700,
    price: 124,
    compareAt: 139,
    rating: 4.9,
    reviews: 167,
    badge: "Limited",
  }),
]

export const categories: { name: Category; tagline: string }[] = [
  { name: "Whisky", tagline: "Single malts & rare casks" },
  { name: "Wine", tagline: "Old-world cellars" },
  { name: "Champagne", tagline: "Grower & vintage" },
  { name: "Gin", tagline: "Botanical small batch" },
  { name: "Rum", tagline: "Aged & single estate" },
  { name: "Tequila", tagline: "100% agave" },
  { name: "Vodka", tagline: "Craft distilled" },
]

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  return priceFormatter.format(value)
}

export function getFeatured(): Product[] {
  return products
}
