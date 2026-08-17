import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type {
  LoyaltyMember,
  LoyaltyMemberAccount,
  LoyaltyMemberLedgerQuery,
  LoyaltyMemberListQuery,
  LoyaltyMemberTransaction,
  LoyaltyProgramme,
} from "../types";

export function getLoyaltyProgramme(): Promise<LoyaltyProgramme> {
  return apiFetch<LoyaltyProgramme>("/admin/loyalty/programme");
}

export function listLoyaltyMembers(
  query: LoyaltyMemberListQuery = {},
): Promise<Paginated<LoyaltyMember>> {
  return apiFetch<Paginated<LoyaltyMember>>(
    `/admin/loyalty/members${buildQueryString(query)}`,
  );
}

export function getLoyaltyMember(
  userID: string,
): Promise<LoyaltyMemberAccount> {
  return apiFetch<LoyaltyMemberAccount>(`/admin/loyalty/members/${userID}`);
}

export function listLoyaltyMemberTransactions(
  userID: string,
  query: LoyaltyMemberLedgerQuery = {},
): Promise<Paginated<LoyaltyMemberTransaction>> {
  return apiFetch<Paginated<LoyaltyMemberTransaction>>(
    `/admin/loyalty/members/${userID}/transactions${buildQueryString(query)}`,
  );
}
