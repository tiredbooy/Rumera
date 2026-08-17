"use client";

import type { ApiErrorEnvelope, ApiSuccess } from "@/lib/api/types";

import type {
  LoyaltyAdjustResult,
  LoyaltyProgramme,
  UpdateLoyaltyProgrammeInput,
} from "../types";

/** Carries per-field messages so the form can focus the offending input. */
export class LoyaltyApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "LoyaltyApiError";
  }
}

async function parseLoyaltyResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new LoyaltyApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }
  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

/**
 * L-1. Writes the programme through the admin BFF proxy, whose allowlist
 * already covers `admin/*`. Gated server-side on customers:write — there is
 * deliberately no loyalty:write capability.
 */
export async function updateLoyaltyProgramme(
  input: UpdateLoyaltyProgrammeInput,
): Promise<LoyaltyProgramme> {
  const response = await fetch("/api/admin/admin/loyalty/programme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseLoyaltyResponse<LoyaltyProgramme>(response);
}

export type AdjustLoyaltyPointsInput = {
  delta: number;
  note?: string;
  idempotencyKey: string;
};

/**
 * L-10. Admin grant / clawback through the same BFF allowlist as programme
 * writes. `Idempotency-Key` is required so retries do not double-apply.
 */
export async function adjustLoyaltyPoints(
  userID: string,
  input: AdjustLoyaltyPointsInput,
): Promise<LoyaltyAdjustResult> {
  const response = await fetch(
    `/api/admin/admin/users/${encodeURIComponent(userID)}/loyalty/adjust`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        delta: input.delta,
        note: input.note,
        idempotency_key: input.idempotencyKey,
      }),
    },
  );
  return parseLoyaltyResponse<LoyaltyAdjustResult>(response);
}
