import "server-only";

import type { ApiErrorEnvelope, ApiSuccess } from "@/lib/api/types";
import type {
  AuthResult,
  RefreshTokenInput,
  SignInInput,
  TokenPair,
  VerifyOtpInput,
} from "../types";

const API_BASE = (
  process.env.BACKEND_INTERNAL_URL ??
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080"
).replace(/\/$/, "");

const AUTH_LOGOUT_TIMEOUT_MS = 5_000;

export class AuthServerError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthServerError";
  }
}

function authServerPost(
  path: string,
  input: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${API_BASE}/api/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });
}

async function authServerFailure(response: Response): Promise<AuthServerError> {
  const body: unknown = await response.json().catch(() => null);
  const error = (body as ApiErrorEnvelope | null)?.error;
  return new AuthServerError(
    response.status,
    error?.code ?? "UNKNOWN",
    error?.message ?? response.statusText,
  );
}

async function authServerRequest<T>(path: string, input: unknown): Promise<T> {
  const response = await authServerPost(path, input);
  if (!response.ok) throw await authServerFailure(response);

  const body: unknown = await response.json().catch(() => null);

  const data = (body as ApiSuccess<T> | null)?.data;
  if (data === undefined) {
    throw new AuthServerError(
      response.status,
      "INVALID_RESPONSE",
      "missing data",
    );
  }
  return data;
}

export function authenticateWithPassword(
  input: SignInInput,
): Promise<AuthResult> {
  return authServerRequest<AuthResult>("auth/login", input);
}

export function authenticateWithOtp(
  input: VerifyOtpInput,
): Promise<AuthResult> {
  return authServerRequest<AuthResult>("auth/otp/verify", input);
}

export function refreshAuthTokens(
  input: RefreshTokenInput,
): Promise<TokenPair> {
  return authServerRequest<TokenPair>("auth/refresh", input);
}

export async function revokeAuthTokens(
  input: RefreshTokenInput,
): Promise<void> {
  const response = await authServerPost(
    "auth/logout",
    input,
    AbortSignal.timeout(AUTH_LOGOUT_TIMEOUT_MS),
  );
  if (!response.ok) throw await authServerFailure(response);
}
