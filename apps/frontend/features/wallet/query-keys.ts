import type { WalletTransactionQuery } from "./types";

export const walletKeys = {
  all: ["wallet"] as const,
  transactions: (query: WalletTransactionQuery = {}) =>
    ["wallet", "transactions", query] as const,
};
