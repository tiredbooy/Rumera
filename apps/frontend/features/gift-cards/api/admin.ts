import "server-only";

import { apiFetch } from "@/lib/api/client";

import type { AdminGiftCard, CreateGiftCardsInput } from "../types";

export function createGiftCards(
  input: CreateGiftCardsInput,
): Promise<AdminGiftCard[]> {
  return apiFetch<AdminGiftCard[]>("/admin/gift-cards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
