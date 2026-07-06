export const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080";

export const BASE_API_URL = `${API_URL.replace(/\/$/, "")}/api/v1`;

/**
 * Build a URL query string from a flat object.
 * - omits keys whose value is `undefined`, `null`, or `""`
 * - includes `false`, `0`, and other falsy-but-meaningful values
 * - does **not** handle arrays – add explicit handling if needed later
 *
 * @returns a `?key=val...` string, or `""` when there are no params
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();

  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null) continue;
    const value = String(raw);
    if (value === "") continue;
    usp.set(key, value);
  }

  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}
