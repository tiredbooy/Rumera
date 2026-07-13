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
