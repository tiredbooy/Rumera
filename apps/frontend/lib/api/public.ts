import { apiFetch, type ApiFetchOptions } from "./client";

export function publicRequest<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  return apiFetch<T>(path, { ...opts, token: undefined });
}
