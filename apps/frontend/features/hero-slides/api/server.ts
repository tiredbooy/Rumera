import "server-only";

import { publicRequest } from "@/lib/api/public";
import { HERO_CACHE_TAG, HOME_CACHE_TAG } from "@/lib/cache-tags";

import type { PublicHeroSlide } from "../types";

const FALLBACK_HERO_SLIDES: PublicHeroSlide[] = [
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
];

export async function listActiveHeroSlides(): Promise<PublicHeroSlide[]> {
  try {
    const slides = await publicRequest<PublicHeroSlide[]>("/hero-slides", {
      cache: "force-cache",
      next: {
        revalidate: 300,
        tags: [HERO_CACHE_TAG, HOME_CACHE_TAG],
      },
    });
    return Array.isArray(slides) ? slides : FALLBACK_HERO_SLIDES;
  } catch {
    return FALLBACK_HERO_SLIDES;
  }
}
