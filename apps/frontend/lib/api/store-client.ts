/**
 * Browser-side fetch helper for the authenticated BFF proxy (`/api/store/*`).
 * Returns the backend's JSON body verbatim (callers pick `.data` or `.results`)
 * and throws a typed error from the `{ error }` envelope.
 */
import type { ApiErrorEnvelope, ApiFieldErrors } from "./types"

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

export async function storeRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/store/${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error
    throw new ApiClientError(
      res.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? res.statusText,
      error?.fields,
    )
  }
  return body as T
}
