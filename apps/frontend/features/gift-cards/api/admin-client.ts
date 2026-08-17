"use client";

import { buildQuery } from "@/lib/api/qs";
import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";

import type {
  AdminGiftCard,
  AdminGiftCardListQuery,
  AdminGiftCardRow,
  CreateGiftCardsInput,
} from "../types";

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

async function readGiftCardResponse<T>(response: Response): Promise<T> {
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

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export async function createGiftCardsClient(
  input: CreateGiftCardsInput,
): Promise<AdminGiftCard[]> {
  const response = await fetch("/api/admin/admin/gift-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readGiftCardResponse<AdminGiftCard[]>(response);
}

/** GET /admin/gift-cards — top-level `{results, pagination}`, not `{data}`. */
export async function listAdminGiftCardsClient(
  query: AdminGiftCardListQuery = {},
): Promise<Paginated<AdminGiftCardRow>> {
  const response = await fetch(
    `/api/admin/admin/gift-cards${buildQuery({ ...query })}`,
  );
  return readGiftCardResponse<Paginated<AdminGiftCardRow>>(response);
}

/** POST /admin/gift-cards/:id/void — active → disabled; not a refund. */
export async function voidAdminGiftCardClient(
  id: number,
): Promise<AdminGiftCardRow> {
  const response = await fetch(`/api/admin/admin/gift-cards/${id}/void`, {
    method: "POST",
  });
  return readGiftCardResponse<AdminGiftCardRow>(response);
}
