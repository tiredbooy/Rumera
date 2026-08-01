"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
} from "@/lib/api/types";

import type { AdminGiftCard, CreateGiftCardsInput } from "../types";

export class GiftCardApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "GiftCardApiError";
  }
}

export async function createGiftCardsClient(
  input: CreateGiftCardsInput,
): Promise<AdminGiftCard[]> {
  const response = await fetch("/api/admin/admin/gift-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new GiftCardApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return (body as ApiSuccess<AdminGiftCard[]>).data;
}
