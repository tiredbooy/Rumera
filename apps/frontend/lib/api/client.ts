// lib/api/client.ts
import "server-only";
import { auth } from "@/lib/auth/auth";
import { API_BASE } from "./base";
import { ApiError } from "./errors";
import type { ApiErrorEnvelope, ApiSuccess } from "./types";

export { API_BASE } from "./base";
export { ApiError } from "./errors";

export type ApiFetchOptions = RequestInit & { token?: string };

/**
 * Universal server-side fetcher.
 *
 * - Explicit `token` takes precedence.
 * - Otherwise, tries to get the session from `auth()` and injects its `accessToken`
 *   automatically if available.
 * - Throws `ApiError` on non‑2xx responses.
 * - Defaults to `cache: "no-store"` unless overridden.
 *
 * Use this in all server components, route handlers, and server actions.
 */
export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { token: explicitToken, headers, ...rest } = opts;

  let token = explicitToken;
  if (!token) {
    try {
      const session = await auth();
      if (session?.accessToken) {
        token = session.accessToken;
      }
    } catch (err) {
      // auth() may fail if called from a context where the session is not available
      // (e.g., during static generation). We log but do not throw – we just proceed
      // without a token, which is fine for public endpoints.
      console.warn(
        "apiFetch: could not retrieve session, proceeding without token",
        err,
      );
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: rest.cache ?? "no-store",
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? res.statusText,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}
