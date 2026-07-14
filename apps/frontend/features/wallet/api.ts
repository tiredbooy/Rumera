import { buildQuery } from "@/lib/api/qs";
import { storeRequest } from "@/lib/api/store-client";
import type { ApiSuccess, Paginated } from "@/lib/api/types";

import type {
  Wallet,
  WalletTransaction,
  WalletTransactionQuery,
  WithdrawWalletInput,
} from "./types";

export function getWallet(): Promise<Wallet> {
  return storeRequest<ApiSuccess<Wallet>>("wallet").then((body) => body.data);
}

export function listWalletTransactions(
  query: WalletTransactionQuery = {},
): Promise<Paginated<WalletTransaction>> {
  return storeRequest<Paginated<WalletTransaction>>(
    `wallet/transactions${buildQuery({ ...query })}`,
  );
}

export function withdrawFromWallet(
  input: WithdrawWalletInput,
): Promise<WalletTransaction> {
  return storeRequest<ApiSuccess<WalletTransaction>>("wallet/withdraw", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.data);
}
