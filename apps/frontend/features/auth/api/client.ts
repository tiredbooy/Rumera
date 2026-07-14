"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types";
import type {
  AuthResult,
  ForgotPasswordInput,
  RequestOtpInput,
  ResetPasswordInput,
  SignUpInput,
} from "../types";

export class AuthClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "AuthClientError";
  }
}

async function authPublicRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/public/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new AuthClientError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function registerAccount(input: SignUpInput): Promise<AuthResult> {
  return authPublicRequest<AuthResult>("auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestOtp(input: RequestOtpInput): Promise<void> {
  await authPublicRequest<void>("auth/otp/request", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<void> {
  await authPublicRequest<unknown>("auth/password/forgot", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await authPublicRequest<unknown>("auth/password/reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
