/**
 * Single source of truth for brand + SEO metadata.
 *
 * Everything that needs to know "who is this site" — the root <metadata>,
 * structured data (JSON-LD), the sitemap, robots and the web manifest — reads
 * from here so the brand stays consistent and is changed in exactly one place.
 *
 * `url` is environment-driven so the same build is correct in dev, staging and
 * prod. Set `NEXT_PUBLIC_SITE_URL` in the environment (see .env.example).
 */
export const siteConfig = {
  name: "رومرا",
  /** Used in <title> templates and OG tags. */
  title: "رومرا — ویسکی، شراب و شامپاینِ نایاب",
  description:
    "سردابه‌ای منتخب از ویسکی کمیاب، شراب دنیای قدیم، شامپاین تولیدکننده و اسپیریت‌های دست‌ساز — مستقیم از سازندگان تهیه و خنک، سریع و زیبا تحویل داده می‌شود.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  locale: "fa_IR",
  /** Brand mark used as the default social share image (generated route). */
  ogImage: "/opengraph-image",
  keywords: [
    "ویسکی",
    "شراب",
    "شامپاین",
    "اسپیریت",
    "بطری‌های کمیاب",
    "تک‌مالت",
    "شامپاین تولیدکننده",
    "شراب اصیل",
    "رومرا",
  ],
  twitter: "@rumera",
  socials: {
    instagram: "https://instagram.com/rumera",
    twitter: "https://twitter.com/rumera",
    facebook: "https://facebook.com/rumera",
  },
} as const;

/** Absolute URL helper for a path on this site. */
export function absoluteUrl(path = "/"): string {
  try {
    const parsed = new URL(path);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // Relative site paths are resolved below.
  }
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
