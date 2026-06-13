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
  /** Persian display name */
  name: string
  /** Persian maker / house name */
  maker: string
  category: Category
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
  badge?: "Limited" | "New" | "Award" | "Rare"
}

/** Persian labels for each category — used everywhere a category is shown. */
export const categoryFa: Record<Category, string> = {
  Whisky: "ویسکی",
  Wine: "شراب",
  Champagne: "شامپاین",
  Gin: "جین",
  Rum: "رام",
  Tequila: "تکیلا",
  Vodka: "ودکا",
}

/** Persian labels for product badges. */
export const badgeFa: Record<NonNullable<Product["badge"]>, string> = {
  Limited: "محدود",
  New: "جدید",
  Award: "برگزیده",
  Rare: "کمیاب",
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

// Slugs stay ASCII (latin) so URLs/anchors remain clean — the catalogue keeps an
// English slug alongside the Persian display name.
function make(
  p: Omit<Product, "hue"> & { hue?: [string, string] }
): Product {
  return {
    ...p,
    hue: p.hue ?? HUES[p.category],
  }
}

export const products: Product[] = [
  make({
    id: "1",
    slug: "aobane-18-year",
    name: "آئوبانه ۱۸ سال",
    maker: "تقطیرخانهٔ آئوبانه",
    category: "Whisky",
    note: "تک‌مالت رسیده در بشکه‌های شِری — انجیر خشک، تافی و رایحه‌ای از نمک دریا.",
    origin: "آیلا، اسکاتلند",
    abv: 46,
    volumeMl: 700,
    price: 18_900_000,
    rating: 4.9,
    reviews: 214,
    badge: "Award",
  }),
  make({
    id: "2",
    slug: "maison-velour-brut",
    name: "مزون وِلور بروت",
    maker: "مزون وِلور",
    category: "Champagne",
    note: "شامپاین تولیدکننده با حباب‌های ریز و ماندگار — بریوش، هلوی سفید و پوست مرکبات.",
    origin: "رَمس، فرانسه",
    abv: 12,
    volumeMl: 750,
    price: 8_400_000,
    compareAt: 9_900_000,
    rating: 4.8,
    reviews: 132,
    badge: "New",
  }),
  make({
    id: "3",
    slug: "chateau-noir-2016",
    name: "شاتو نوآر ۲۰۱۶",
    maker: "شاتو نوآر",
    category: "Wine",
    note: "بلندِ بوردوی پرعمق — انگورفرنگی سیاه، چوب سِدر، گرافیت و تانن‌های مخملی.",
    origin: "پویاک، فرانسه",
    abv: 14,
    volumeMl: 750,
    price: 14_200_000,
    rating: 4.7,
    reviews: 98,
    badge: "Limited",
  }),
  make({
    id: "4",
    slug: "botanic-no-7",
    name: "بوتانیک شمارهٔ ۷",
    maker: "هَرو و وِیل",
    category: "Gin",
    note: "جین لندن درای در دسته‌های کوچک — سرشار از سروکوهی با گشنیز، پوست گریپ‌فروت و گل بیدمشک.",
    origin: "لندن، انگلستان",
    abv: 43,
    volumeMl: 700,
    price: 4_800_000,
    rating: 4.6,
    reviews: 176,
  }),
  make({
    id: "5",
    slug: "isla-vieja-anejo",
    name: "ایسلا ویخا آنیخو",
    maker: "ایسلا ویخا",
    category: "Rum",
    note: "دوازده سال در بلوط — نان موز، شکر سوخته، ادویه و پایانی گرم و طولانی.",
    origin: "بریجتاون، باربادوس",
    abv: 40,
    volumeMl: 700,
    price: 7_200_000,
    rating: 4.8,
    reviews: 143,
    badge: "Rare",
  }),
  make({
    id: "6",
    slug: "sol-de-agave-blanco",
    name: "سول د آگاوه بلانکو",
    maker: "سول د آگاوه",
    category: "Tequila",
    note: "تکیلای کوهستانی بدون افزودنی — آگاوهٔ پخته، سیب سبز، فلفل سفید و مرکبات.",
    origin: "خالیسکو، مکزیک",
    abv: 40,
    volumeMl: 750,
    price: 5_900_000,
    rating: 4.7,
    reviews: 121,
    badge: "New",
  }),
  make({
    id: "7",
    slug: "polar-crystal",
    name: "پولار کریستال",
    maker: "پولار کریستال",
    category: "Vodka",
    note: "هفت‌بار تقطیرشده از گندم زمستانه — زلال، لطیف و با پایانی از فلفل تازه.",
    origin: "مازوویا، لهستان",
    abv: 40,
    volumeMl: 700,
    price: 3_800_000,
    rating: 4.5,
    reviews: 89,
  }),
  make({
    id: "8",
    slug: "aobane-cask-strength",
    name: "آئوبانه کَسک‌استرنث",
    maker: "تقطیرخانهٔ آئوبانه",
    category: "Whisky",
    note: "بطری‌شده با قدرت کامل — دود آتش، شکلات تلخ و مارمالاد پرتقال.",
    origin: "آیلا، اسکاتلند",
    abv: 58.4,
    volumeMl: 700,
    price: 12_400_000,
    compareAt: 13_900_000,
    rating: 4.9,
    reviews: 167,
    badge: "Limited",
  }),
]

export const categories: { name: Category; tagline: string }[] = [
  { name: "Whisky", tagline: "تک‌مالت‌ها و بشکه‌های کمیاب" },
  { name: "Wine", tagline: "سردابه‌های دنیای قدیم" },
  { name: "Champagne", tagline: "تولیدکننده و وینتیج" },
  { name: "Gin", tagline: "گیاهی و دسته‌کوچک" },
  { name: "Rum", tagline: "رسیده و تک‌املاک" },
  { name: "Tequila", tagline: "۱۰۰٪ آگاوه" },
  { name: "Vodka", tagline: "تقطیر دست‌ساز" },
]

/** Persian-digit number formatter (groups, digits and decimals localised). */
const faNumberFormatter = new Intl.NumberFormat("fa-IR")

export function faNum(value: number): string {
  return faNumberFormatter.format(value)
}

const tomanFormatter = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 0,
})

/** Formats a Toman price with Persian digits, e.g. «۱۸٬۹۰۰٬۰۰۰ تومان». */
export function formatPrice(value: number): string {
  return `${tomanFormatter.format(value)} تومان`
}

export function getFeatured(): Product[] {
  return products
}
