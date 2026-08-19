import { ApiError } from "./errors";

export function isApiNotFoundError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

export function isApiNotModifiedError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 304 &&
    error.code === "NOT_MODIFIED"
  );
}

/** Error details safe for build logs: no request URLs, messages, or response bodies. */
export function getSafeApiErrorContext(error: unknown): {
  name: string;
  status?: number;
  code?: string;
} {
  if (error instanceof ApiError) {
    return { name: error.name, status: error.status, code: error.code };
  }

  return { name: error instanceof Error ? error.name : "UnknownError" };
}
