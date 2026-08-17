/**
 * Single source of truth for the backend origin.
 *
 * This used to be defined three times — `lib/api/base.ts`,
 * `lib/utils/api-helpers.ts` and `features/auth/api/server.ts` — with three
 * slightly different precedence chains. Only the auth one honoured
 * `BACKEND_INTERNAL_URL`, so a deployment that set only that variable sent
 * auth over the internal network and every other server fetch to the public
 * origin. Both compose files happen to set `API_URL` and `BACKEND_INTERNAL_URL`
 * to the same value, which is why nobody noticed.
 *
 * Precedence, highest first:
 *
 *   BACKEND_INTERNAL_URL  server-only; the in-cluster hostname (http://backend:8080)
 *   API_URL               server-only; explicit override
 *   NEXT_PUBLIC_API_URL   the browser-facing origin, inlined at build time
 *   http://localhost:8080 local dev fallback
 *
 * In the browser only `NEXT_PUBLIC_*` is inlined; the server-only names read as
 * undefined and the chain falls through on its own, so one function is correct
 * on both sides of the RSC boundary. That is why this module is deliberately
 * NOT marked "server-only" — `lib/api/base.ts` keeps that guarantee for the
 * server-only surface.
 */

const DEFAULT_ORIGIN = "http://localhost:8080";

/** Strip trailing slashes so callers can always join with a leading `/`. */
function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Read an env var without assuming `process.env` exists (older RN/edge shims). */
function env(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

/**
 * Resolve the backend origin, e.g. `http://backend:8080`.
 *
 * Evaluated per call rather than cached at module load so tests can override
 * the environment, and so a server restart picks up a changed value.
 */
export function resolveApiOrigin(): string {
  return normalizeOrigin(
    env("BACKEND_INTERNAL_URL") ??
      env("API_URL") ??
      env("NEXT_PUBLIC_API_URL") ??
      DEFAULT_ORIGIN,
  );
}

/** Resolve the versioned API base, e.g. `http://backend:8080/api/v1`. */
export function resolveApiBase(): string {
  return `${resolveApiOrigin()}/api/v1`;
}
