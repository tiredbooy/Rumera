/**
 * Builds a query string from a params object, skipping null/undefined/empty
 * values. Array values repeat the key (`ids=1&ids=2`). Isomorphic — safe in both
 * server fetchers and client hooks.
 */
type QueryValue = string | number | boolean | null | undefined | (string | number)[]

export function buildQuery(params: Record<string, QueryValue> = {}): string {
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, String(v))
    } else {
      sp.set(key, String(value))
    }
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}
