/**
 * Thin typed client for the Go backend.
 *
 * - Targets `${API_URL}/api/v1` and unwraps the `{ data }` success envelope.
 * - Throws a typed `ApiError` built from the `{ error: { code, message } }`
 *   envelope (see `apps/backend/docs/conventions.md`).
 * - `serverApi` injects the caller's bearer token from the next-auth session, so
 *   server components / route handlers hit customer- and admin-tier endpoints
 *   without threading the token around by hand.
 */
import "server-only"
import { auth } from "@/lib/auth/auth"

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
export const API_BASE = `${API.replace(/\/$/, "")}/api/v1`

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export type ApiFetchOptions = RequestInit & { token?: string }

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = opts
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    // Dashboard data is per-user; never cache unless a caller opts in.
    cache: rest.cache ?? "no-store",
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? res.statusText
    )
  }

  return (body?.data ?? body) as T
}

/** Authenticated server-side fetch — pulls the bearer token from the session. */
export async function serverApi<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const session = await auth()
  return apiFetch<T>(path, { ...opts, token: session?.accessToken })
}
