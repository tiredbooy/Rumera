/**
 * Editorial cocktail recipes. Small curated dataset that powers the /recipes
 * pages and their Recipe JSON-LD (strong GEO/AI-search signal). Swap for the
 * backend recipes feature (`/api/v1/recipes`) when wiring live data.
 */
export type Recipe = {
  slug: string
  name: string
  description: string
  /** Loosely related catalogue category, for cross-linking. */
  spirit: string
  totalTime: string
  ingredients: string[]
  steps: string[]
  hue: string
}

export const recipes: Recipe[] = [
  {
    slug: "old-fashioned",
    name: "اولد فشن",
    description:
      "کلاسیکِ همیشگی ویسکی — قند، تلخی و پوست پرتقال، ساده و بی‌زمان.",
    spirit: "ویسکی",
    totalTime: "PT5M",
    ingredients: [
      "۶۰ میلی‌لیتر ویسکی",
      "یک حبه قند",
      "دو دش بیترِ معطر",
      "پوست پرتقال",
    ],
    steps: [
      "قند و بیتر را در لیوان با کمی آب حل کنید.",
      "یخ و ویسکی را اضافه کرده و به‌آرامی هم بزنید.",
      "با پوست پرتقال تزئین و سِرو کنید.",
    ],
    hue: "oklch(0.62 0.13 65)",
  },
  {
    slug: "negroni",
    name: "نگرونی",
    description:
      "توازنِ تلخ و تلخِ دلپذیر — جین، ورموت قرمز و بیترِ ایتالیایی به نسبت برابر.",
    spirit: "جین",
    totalTime: "PT4M",
    ingredients: [
      "۳۰ میلی‌لیتر جین",
      "۳۰ میلی‌لیتر ورموت قرمز",
      "۳۰ میلی‌لیتر بیترِ ایتالیایی",
      "پوست پرتقال",
    ],
    steps: [
      "همهٔ مواد را با یخ در لیوان هم بزنید.",
      "روی یخِ تازه صاف کنید.",
      "با پوست پرتقال تزئین کنید.",
    ],
    hue: "oklch(0.45 0.16 18)",
  },
  {
    slug: "daiquiri",
    name: "دایکیری",
    description:
      "سه‌گانهٔ بی‌نقص — رام، آب‌لیمو و شکر؛ تر و تازه و سرحال.",
    spirit: "رام",
    totalTime: "PT4M",
    ingredients: [
      "۶۰ میلی‌لیتر رام سفید",
      "۲۵ میلی‌لیتر آب‌لیموی تازه",
      "۱۵ میلی‌لیتر شربت ساده",
    ],
    steps: [
      "همهٔ مواد را با یخ به‌شدت شِیک کنید.",
      "در گیلاس کوکتلِ خنک صاف کنید.",
      "بی‌درنگ سِرو کنید.",
    ],
    hue: "oklch(0.55 0.13 55)",
  },
]

export function getRecipe(slug: string): Recipe | undefined {
  return recipes.find((r) => r.slug === slug)
}
