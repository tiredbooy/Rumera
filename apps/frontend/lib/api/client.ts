// lib/api/client.ts
import "server-only";
import { headers as requestHeaders } from "next/headers";

import { getAccessTokenFromJwt } from "@/lib/auth/auth.config";
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
 * - Otherwise, reads the Go access JWT from the encrypted Auth.js cookie via
 *   `getToken` (never from `session.accessToken` / `GET /api/auth/session`).
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
      token = await getAccessTokenFromJwt({ headers: await requestHeaders() });
    } catch (err) {
      // getToken / headers() may fail if called from a context where the
      // request is not available (e.g., during static generation). We log but
      // do not throw – we just proceed without a token, which is fine for
      // public endpoints.
      console.warn(
        "apiFetch: could not retrieve access token, proceeding without token",
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
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}
