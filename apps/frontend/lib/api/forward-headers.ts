/**
 * Copy a client `Idempotency-Key` onto the upstream header map when present.
 * Never invents a key. Callers must not log the value.
 */
export function pickIdempotencyKeyHeader(
  incoming: Pick<Headers, "get">,
): Record<string, string> {
  const key = incoming.get("Idempotency-Key");
  if (!key) return {};
  return { "Idempotency-Key": key };
}

/** First-party analytics visitor cookies. Store BFF may copy these only. */
export const ANALYTICS_COOKIE_NAMES = ["sid", "did"] as const;

/**
 * Copy incoming `sid`/`did` cookies onto the upstream Cookie header.
 * Never invents IDs. Other cookies are left behind.
 */
export function pickAnalyticsCookieHeader(
  incoming: Pick<Headers, "get">,
): Record<string, string> {
  const header = incoming.get("cookie");
  if (!header) return {};
  const parts: string[] = [];
  for (const name of ANALYTICS_COOKIE_NAMES) {
    const value = cookieValue(header, name);
    if (value) parts.push(`${name}=${value}`);
  }
  if (parts.length === 0) return {};
  return { Cookie: parts.join("; ") };
}

/** Keep only upstream Set-Cookie lines for `sid`/`did`. */
export function pickAnalyticsSetCookies(setCookies: readonly string[]): string[] {
  const names = new Set<string>(ANALYTICS_COOKIE_NAMES);
  return setCookies.filter((line) => names.has(setCookieName(line)));
}

function cookieValue(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    const key = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim();
    if (key !== name) continue;
    const value = eq === -1 ? "" : trimmed.slice(eq + 1).trim();
    return value || undefined;
  }
  return undefined;
}

function setCookieName(line: string): string {
  return line.split("=", 1)[0]?.trim() ?? "";
}
