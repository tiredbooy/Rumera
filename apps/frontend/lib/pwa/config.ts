/**
 * PWA policy — cache names, routes, and privacy boundaries.
 *
 * Service worker + install UI import these constants so browser code and
 * documentation stay aligned. Never cache authenticated or mutation surfaces.
 */

export const PWA_CACHE_VERSION = "rumera-pwa-v1";

export const PWA_CACHES = {
  /** App shell + offline fallback (precache). */
  precache: `${PWA_CACHE_VERSION}-precache`,
  /** Hashed Next static chunks and fonts. */
  static: `${PWA_CACHE_VERSION}-static`,
  /** Public storefront documents (network-first, short retention). */
  pages: `${PWA_CACHE_VERSION}-pages`,
} as const;

/** Paths precached on install (must be GET + cacheable + unauthenticated). */
export const PWA_PRECACHE_URLS = [
  "/offline",
  "/logo/Rumera-Light.svg",
  "/logo/Rumra-Dark.svg",
  "/logo/Rumera-Light.png",
  "/logo/Rumra-Dark.png",
] as const;

/**
 * Path prefixes that must never enter the Cache API.
 * Includes auth, account, admin, checkout, and all BFF/API surfaces.
 */
export const PWA_NEVER_CACHE_PREFIXES = [
  "/api/",
  "/admin",
  "/account",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/forbidden",
] as const;

/** Query params that imply personalized or mutation state. */
export const PWA_SENSITIVE_QUERY_KEYS = [
  "token",
  "access_token",
  "callbackUrl",
  "session",
] as const;

export const PWA_THEME = {
  backgroundColor: "#2b231c",
  themeColorDark: "#2b231c",
  themeColorLight: "#faf8f4",
} as const;

/** Manifest shortcuts — deep links that feel like native home actions. */
export const PWA_SHORTCUTS = [
  {
    name: "فروشگاه",
    short_name: "فروشگاه",
    description: "مرور همهٔ محصولات",
    url: "/products",
  },
  {
    name: "سبد خرید",
    short_name: "سبد",
    description: "مشاهدهٔ سبد خرید",
    url: "/cart",
  },
  {
    name: "دستورها",
    short_name: "دستورها",
    description: "دستورهای کوکتل و جفت‌سازی",
    url: "/recipes",
  },
  {
    name: "جستجو",
    short_name: "جستجو",
    description: "جستجوی سریع در کاتالوگ",
    url: "/search",
  },
] as const;

export function shouldNeverCachePath(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  return PWA_NEVER_CACHE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix),
  );
}

export function pathHasSensitiveQuery(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return PWA_SENSITIVE_QUERY_KEYS.some((key) => params.has(key));
}

/** Enable SW registration outside production only when explicitly opted in. */
export function isPwaRuntimeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NEXT_PUBLIC_PWA === "0") return false;
  if (env.NODE_ENV === "production") return true;
  return env.NEXT_PUBLIC_PWA === "1";
}
