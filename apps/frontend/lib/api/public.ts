import "server-only";

import { API_BASE, ApiError, type ApiFetchOptions } from "./client";
import type { ApiErrorEnvelope, ApiSuccess } from "./types";

type PublicRequestOptions = Omit<ApiFetchOptions, "token">;

export async function publicRequest<T>(
  path: string,
  opts: PublicRequestOptions = {},
): Promise<T> {
  const { headers, ...rest } = opts;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...headers,
    },
    cache: rest.cache ?? "no-store",
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}
