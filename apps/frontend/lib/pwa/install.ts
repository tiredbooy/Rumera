/**
 * Install / standalone detection helpers (browser-only).
 * Used by the install prompt and iOS Add-to-Home-Screen guidance.
 */

export type DisplayMode = "browser" | "standalone" | "minimal-ui" | "fullscreen";

export function getDisplayMode(): DisplayMode {
  if (typeof window === "undefined") return "browser";
  const modes: DisplayMode[] = ["fullscreen", "standalone", "minimal-ui"];
  for (const mode of modes) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode;
  }
  // iOS Safari legacy
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return "standalone";
  return "browser";
}

export function isStandaloneDisplay(): boolean {
  return getDisplayMode() !== "browser";
}

export function isIosDevice(userAgent = ""): boolean {
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /iphone|ipad|ipod/i.test(ua);
}

export function isAndroidDevice(userAgent = ""): boolean {
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /android/i.test(ua);
}

export function isSafariBrowser(userAgent = ""): boolean {
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome|android/i.test(ua);
  return isSafari || (isIosDevice(ua) && /safari/i.test(ua) && !/crios|fxios/i.test(ua));
}

/** iOS does not fire beforeinstallprompt — show manual A2HS steps instead. */
export function needsManualIosInstall(userAgent = ""): boolean {
  return isIosDevice(userAgent) && !isStandaloneDisplay();
}

export const PWA_INSTALL_DISMISS_KEY = "rumera:pwa-install-dismissed";
export const PWA_UPDATE_DISMISS_KEY = "rumera:pwa-update-dismissed";
