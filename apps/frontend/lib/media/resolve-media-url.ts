/**
 * Canonical media URL resolution for Rumera.
 *
 * Persisted values stay origin-independent (`/media/{key}` or absolute external
 * CDN URLs). This module is the only place that joins a configured media/API
 * origin so local frontend (e.g. :3000) and backend (:8080) can diverge without
 * baking hosts into the database.
 *
 * Protocol policy:
 * - Development: explicit `http://` media/API origins are allowed.
 * - Production: a *configured* media/API origin must be `https://` (or empty for
 *   same-origin behind a reverse proxy). Already-absolute content URLs are left
 *   intact so historical data is not rewritten.
 */

export type MediaTransformParams = {
  f?: "avif" | "webp" | "jpeg" | "png";
  q?: number;
  w?: number;
  h?: number;
  fit?: "cover" | "contain" | "inside";
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isBrowserOnlyUrl(value: string): boolean {
  return (
    value.startsWith("blob:") ||
    value.startsWith("data:") ||
    value.startsWith("about:")
  );
}

/**
 * Read and validate the configured media origin (no path, no trailing slash).
 * Falls back to the public API origin, then same-origin (empty string).
 */
export function configuredMediaOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidates = [
    env.NEXT_PUBLIC_MEDIA_BASE_URL,
    env.NEXT_PUBLIC_API_URL,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      continue;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      continue;
    }

    // Production must not point browsers at an insecure *configured* origin
    // (mixed content / accidental protocol downgrade). Same-origin (empty) is fine.
    if (
      env.NODE_ENV === "production" &&
      parsed.protocol === "http:"
    ) {
      continue;
    }

    // Origin only — drop path/query so we never produce /api/v1/media/...
    return trimTrailingSlash(parsed.origin);
  }

  return "";
}

/**
 * Normalize a storage key for the transform pipeline.
 * Accepts `products/a.webp`, `/media/products/a.webp`, or full media URLs.
 */
export function normalizeMediaStorageKey(
  key: string | null | undefined,
): string | null {
  if (!key) return null;
  let value = key.trim();
  if (!value) return null;

  if (isAbsoluteHttpUrl(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  value = value.split(/[?#]/)[0] ?? value;
  value = value.replace(/^\/+/, "");
  if (value.startsWith("media/")) {
    value = value.slice("media/".length);
  }
  value = value.replace(/^\/+/, "");
  return value || null;
}

function joinMediaPath(origin: string, mediaPath: string): string {
  const path = mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`;
  if (!origin) return path;
  // Avoid origin/media + /media/... doubling if a caller passes a bare origin
  // that already ends with /media (misconfiguration).
  if (origin.endsWith("/media") && path.startsWith("/media/")) {
    return `${origin.slice(0, -"/media".length)}${path}`;
  }
  return `${origin}${path}`;
}

/**
 * Resolve any persisted or preview media reference to a browser-fetchable URL.
 *
 * - `null` / blank → `null`
 * - `blob:` / `data:` → unchanged (upload previews)
 * - absolute `http(s)` → unchanged (no second origin prefix)
 * - `/media/...` → joined with {@link configuredMediaOrigin}
 * - other root-relative paths (e.g. `/images/hero.jpg`) → left same-origin
 */
export function resolveMediaUrl(
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isBrowserOnlyUrl(trimmed)) {
    return trimmed;
  }

  if (isAbsoluteHttpUrl(trimmed)) {
    try {
      // Normalize without changing host/path; reject non-http schemes that
      // slipped past the regex via weird encodings.
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  // Protocol-relative //cdn.example/foo — rare; resolve against https in prod.
  if (trimmed.startsWith("//")) {
    const scheme =
      env.NODE_ENV === "production" ? "https:" : "http:";
    try {
      return new URL(`${scheme}${trimmed}`).toString();
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/media/") || trimmed === "/media") {
    const origin = configuredMediaOrigin(env);
    // Collapse accidental /media/media/...
    const path = trimmed.replace(/^\/media(?:\/media)+/, "/media");
    return joinMediaPath(origin, path === "/media" ? "/media/" : path);
  }

  // Same-origin static assets and other relative paths stay on the site origin.
  // Bare storage keys must go through mediaTransformUrl / OptimizedImage.imageKey —
  // never invent /media/... from arbitrary relative strings.
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Build a transform-pipeline URL for a storage key.
 * Always produces `{origin}/media/{key}?…` without duplicating `/media`.
 */
export function mediaTransformUrl(
  key: string,
  params: MediaTransformParams = {},
  env: NodeJS.ProcessEnv = process.env,
): string {
  const cleanKey = normalizeMediaStorageKey(key);
  if (!cleanKey) {
    return resolveMediaUrl("/media/", env) ?? "/media/";
  }

  const search = new URLSearchParams();
  // Omit `f` unless a caller asked for a specific format so the backend can
  // content-negotiate AVIF. Never default to webp here.
  if (params.f) search.set("f", params.f);
  if (params.q != null) search.set("q", String(params.q));
  if (params.w != null) search.set("w", String(params.w));
  if (params.h != null) search.set("h", String(params.h));
  if (params.fit) search.set("fit", params.fit);
  const qs = search.toString();

  const origin = configuredMediaOrigin(env);
  const path = `/media/${cleanKey}`;
  return `${joinMediaPath(origin, path)}${qs ? `?${qs}` : ""}`;
}

/** True when the value is (or resolves as) a backend media pipeline path. */
export function isMediaPipelinePath(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith("/media/") || trimmed === "/media") return true;
  if (!isAbsoluteHttpUrl(trimmed)) return false;
  try {
    return new URL(trimmed).pathname.startsWith("/media/");
  } catch {
    return false;
  }
}
