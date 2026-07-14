const CALLBACK_ORIGIN = "https://rumera.local";

/** Return only same-origin relative callbacks, normalized for router navigation. */
export function safeCallbackUrl(
  value: string | null | undefined,
  fallback = "/account",
): string {
  if (!value) return fallback;

  try {
    const url = new URL(value, CALLBACK_ORIGIN);
    if (url.origin !== CALLBACK_ORIGIN || !value.startsWith("/")) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
