export type GiftCardStatus = "active" | "redeemed" | "disabled";

export interface RedeemGiftCardInput {
  code: string;
}

/** Result of POST /gift-cards/redeem. Gift cards are single-use. */
export interface GiftCardRedemption {
  amount: string;
}

/** Admin projection returned by POST /admin/gift-cards. */
export interface AdminGiftCard {
  code: string;
  initial_amount: string;
  status: GiftCardStatus;
  created_at: string;
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
