import "server-only";

import type { Paginated, PaginationQuery } from "@/lib/api/types";
import type { WalletTransaction } from "@/features/wallet/types";
import { apiFetch } from "@/lib/api/client";
import { buildQueryString } from "@/lib/utils/api-helpers";

/**
 * The customer file's wallet ledger (A-10's admin read route, first consumer).
 *
 * A wallet-paid order settles inside the order transaction and writes no
 * `payment_transactions` row, so this ledger is the only admin trail that debit
 * has — the payments board is empty for it. Read-only and gated on
 * `customers:read`, the same capability that opens this screen, so it never
 * needs the `wallet:credit` grant that mints money.
 */
export function listCustomerWalletTransactions(
  userID: string,
  query: PaginationQuery = {},
): Promise<Paginated<WalletTransaction>> {
  return apiFetch<Paginated<WalletTransaction>>(
    `/admin/users/${userID}/wallet/transactions${buildQueryString(query)}`,
  );
}
