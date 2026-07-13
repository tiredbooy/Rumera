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

async function authServerRequest<T>(path: string, input: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new AuthServerError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
    );
  }

  const data = (body as ApiSuccess<T> | null)?.data;
  if (data === undefined) {
    throw new AuthServerError(response.status, "INVALID_RESPONSE", "missing data");
  }
  return data;
}

export function authenticateWithPassword(input: SignInInput): Promise<AuthResult> {
  return authServerRequest<AuthResult>("auth/login", input);
}

export function authenticateWithOtp(input: VerifyOtpInput): Promise<AuthResult> {
  return authServerRequest<AuthResult>("auth/otp/verify", input);
}

export function refreshAuthTokens(input: RefreshTokenInput): Promise<TokenPair> {
  return authServerRequest<TokenPair>("auth/refresh", input);
}
