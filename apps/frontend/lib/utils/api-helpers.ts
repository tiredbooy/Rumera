// The API_URL / BASE_API_URL constants that used to live here were a third copy
// of the origin-resolution chain and had no importers — every consumer of this
// module only wants buildQueryString. Use `resolveApiOrigin` / `resolveApiBase`
// from "@/lib/api/origin" (or the server-only re-export in "@/lib/api/base").

/**
 * Build a URL query string from a flat object.
 * - omits keys whose value is `undefined`, `null`, or `""`
 * - includes `false`, `0`, and other falsy-but-meaningful values
 * - does **not** handle arrays – add explicit handling if needed later
 *
 * @returns a `?key=val...` string, or `""` when there are no params
 */
export function buildQueryString<T extends object>(params: T): string {
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
