import "server-only";

import { API_BASE } from "./base";
import type { ApiFetchOptions } from "./client";
import { ApiError } from "./errors";
import { readJsonOrNull } from "./read-json";
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

  if (response.status === 304) {
    throw new ApiError(304, "NOT_MODIFIED", response.statusText || "Not Modified");
  }

  const body: unknown = await readJsonOrNull(response);

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
