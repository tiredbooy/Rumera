/**
 * Campaign params must survive a canonicalizing redirect.
 *
 * Every storefront list route parses its own search params and redirects to a
 * canonical URL. Each one treated *any* unrecognised key as proof the URL needed
 * correcting, and each href builder rebuilt the URL from its own known keys only —
 * so `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`,
 * `gclid` and `fbclid` were stripped on the way through, after a full round trip,
 * before the Go analytics middleware ever saw them
 * (`internal/middlewares/analytics.go` reads them straight off the query string).
 * Every paid click to a catalogue, category, journal or recipe page lost its
 * attribution and paid a redirect before first paint.
 *
 * A route owns its own params. Everything else rides along untouched.
 */

/** Unknown params, repeats preserved, in the order they arrived. */
export type RoutePassthrough = readonly (readonly [string, string])[];

export type RouteSearchParamsRecord = Record<
  string,
  string | string[] | undefined
>;

/**
 * Collects the params a route does not own.
 *
 * `owned` is what the route parses and rebuilds; `legacy` is what it deliberately
 * drops (a legacy alias it rewrites). A legacy key must be excluded here too, or
 * the redirect would carry it to the corrected URL and bounce forever.
 */
export function collectRoutePassthrough(
  searchParams: RouteSearchParamsRecord,
  owned: ReadonlySet<string>,
  legacy: ReadonlySet<string> = new Set(),
): RoutePassthrough {
  const passthrough: [string, string][] = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (owned.has(key) || legacy.has(key)) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      passthrough.push([key, item]);
    }
  }
  return passthrough;
}

/** Appends the passthrough params to a canonical href built by the route. */
export function withRoutePassthrough(
  href: string,
  passthrough: RoutePassthrough,
): string {
  if (passthrough.length === 0) return href;
  const extra = new URLSearchParams(
    passthrough.map(([key, value]) => [key, value]),
  ).toString();
  return `${href}${href.includes("?") ? "&" : "?"}${extra}`;
}
