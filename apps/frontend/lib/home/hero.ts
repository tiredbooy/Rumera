/**
 * Storefront home hero-slide fetcher (server-side, ISR-cached).
 *
 * Mirrors the catalogue fetchers in `lib/catalog`: error-safe (returns a sane
 * fallback when the backend is unreachable so `next build` and rendering never
 * hard-fail) and ISR-cached. Backed by the Go `GET /hero-slides` endpoint, which
 * serves only active slides within their scheduling window, ordered for display.
 */
const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
const BASE = `${API.replace(/\/$/, "")}/api/v1`
const REVALIDATE = 300

export type HeroSlide = {
  id: number
  eyebrow: string | null
  title: string
  subtitle: string | null
  badge: string | null
  /** Landscape/desktop asset. See public/images/README for the size spec. */
  image_url: string
  /** Optional portrait crop for small screens. */
  mobile_image_url: string | null
  image_alt: string | null
  cta_label: string | null
  cta_href: string | null
  secondary_cta_label: string | null
  secondary_cta_href: string | null
  /** Text-contrast theme over the image: "light" text or "dark" text. */
  theme: "light" | "dark"
  sort_order: number
}

/**
 * A built-in fallback so the hero always renders something premium even with the
 * backend down or no slides configured yet.
 */
export const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: -1,
    eyebrow: "فروشگاه منتخب رومرا",
    title: "هر سلیقه، یک انتخاب درست",
    subtitle:
      "از نوشیدنی‌های دست‌چین تا لوازم خانه و آشپزخانه — مجموعه‌ای گسترده، با تضمین اصالت و ارسالی مطمئن به سراسر کشور.",
    badge: "تازه‌ رسیده‌ها",
    image_url: "/images/hero/slide-1.jpg",
    mobile_image_url: null,
    image_alt: "مجموعه منتخب رومرا",
    cta_label: "مشاهده فروشگاه",
    cta_href: "/products",
    secondary_cta_label: "دسته‌بندی‌ها",
    secondary_cta_href: "/categories",
    theme: "dark",
    sort_order: 1,
  },
  {
    id: -2,
    eyebrow: "الهام برای هر لحظه",
    title: "دستورها و ایده‌هایی که کنارتان می‌مانند",
    subtitle:
      "از کوکتل‌های خانگی تا میزبانی بی‌نقص؛ راهنماها و دستورهای رومرا را کشف کنید.",
    badge: null,
    image_url: "/images/hero/slide-3.jpg",
    mobile_image_url: null,
    image_alt: "دستورها و ایده‌های رومرا",
    cta_label: "کاوش دستورها",
    cta_href: "/recipes",
    secondary_cta_label: "خواندن ژورنال",
    secondary_cta_href: "/journal",
    theme: "dark",
    sort_order: 2,
  },
]

export async function getHeroSlides(): Promise<HeroSlide[]> {
  try {
    const res = await fetch(`${BASE}/hero-slides`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return FALLBACK_SLIDES
    const body = (await res.json()) as { data?: HeroSlide[] } | HeroSlide[]
    const slides = Array.isArray(body) ? body : (body?.data ?? [])
    return slides.length > 0 ? slides : FALLBACK_SLIDES
  } catch {
    return FALLBACK_SLIDES
  }
}
