export type GiftCardStatus = "active" | "redeemed" | "disabled";

export interface RedeemGiftCardInput {
  code: string;
}

/** Result of POST /gift-cards/redeem. Gift cards are single-use. */
export interface GiftCardRedemption {
  amount: string;
}

/** Admin projection returned by POST /admin/gift-cards (issue batch). */
export interface AdminGiftCard {
  code: string;
  initial_amount: string;
  status: GiftCardStatus;
  created_at: string;
}

/**
 * Staff ledger row from GET /admin/gift-cards and POST /admin/gift-cards/:id/void.
 * `id` is the void target — the issue batch response does not include it.
 */
export interface AdminGiftCardRow {
  id: number;
  code: string;
  initial_amount: string;
  status: GiftCardStatus;
  purchaser_user_id?: number;
  purchase_txid?: string;
  redeemed_by?: number;
  redeemed_at?: string;
  created_at: string;
}

/** Query accepted by GET /admin/gift-cards. */
export interface AdminGiftCardListQuery {
  page?: number;
  limit?: number;
  status?: GiftCardStatus;
  search?: string;
  sortBy?: "created_at" | "initial_amount" | "status";
  orderBy?: "asc" | "desc";
}

export interface CreateGiftCardsInput {
  amount: string;
  /** Omission asks the backend to issue one card. */
  count?: number;
}

/** POST /gift-cards/purchase (gateway-funded; no code until paid). */
export interface PurchaseGiftCardInput {
  amount: number;
}

/** Pending gateway intent from POST /gift-cards/purchase. */
export interface GiftCardPurchaseIntent {
  payment_id: number;
  transaction_id: string;
  amount: string;
  currency: string;
  status: string;
  /** Absolute gateway start URL from the API. Empty when env is unset. */
  payment_url?: string;
}

/**
 * Non-empty API `payment_url` only. Never invent a start URL from
 * `transaction_id` or a default host.
 */
export function usablePaymentUrl(
  url?: string | null,
): string | undefined {
  const trimmed = typeof url === "string" ? url.trim() : "";
  return trimmed ? trimmed : undefined;
}

/** GET /gift-cards/mine — codes the caller purchased (self-delivery). */
export interface PurchasedGiftCard {
  code: string;
  initial_amount: string;
  status: GiftCardStatus;
  purchase_txid?: string;
  created_at: string;
}

/** Amount bounds aligned with backend Min/MaxPurchaseAmount (IRT). */
export const GIFT_CARD_PURCHASE_MIN = 10_000;
export const GIFT_CARD_PURCHASE_MAX = 50_000_000;

/** Storefront presets (Toman). Same family as wallet top-up. */
export const GIFT_CARD_PURCHASE_PRESETS = [
  50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;

export function isValidGiftCardPurchaseAmount(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= GIFT_CARD_PURCHASE_MIN &&
    amount <= GIFT_CARD_PURCHASE_MAX
  );
}
