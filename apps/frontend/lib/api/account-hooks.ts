"use client"

/**
 * Account-only React Query hooks (Agent B namespace). These cover the customer
 * self-service surfaces that `lib/api/hooks.ts` doesn't already expose: wallet
 * balance + ledger, address mutation (update/delete/set-default), personalised
 * recommendations, the customer's own reviews, and profile updates.
 *
 * Hooks that already live in `lib/api/hooks.ts` (orders, addresses list/create,
 * loyalty, subscriptions, taste, gift cards, referrals) are imported from there
 * by the pages — this file never duplicates them. Query keys reuse the shared
 * `queryKeys` factory where one already exists so cache invalidation stays
 * consistent across the app (e.g. gift-card redemption already invalidates the
 * `["wallet"]` key, refreshing the views below).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "./query-keys"
import { buildQuery } from "./qs"
import { storeRequest } from "./store-client"
import type { Address, AddressInput, Paginated } from "@/lib/catalog/types"

// ── Wallet ─────────────────────────────────────────────────────────────────

/**
 * Wallet ledger entry, mirroring the backend `WalletTransactionResponse`.
 * `amount` is always a POSITIVE magnitude; `type` decides whether it credits or
 * debits the balance. `balance_after` is the running balance the backend
 * recorded at the time of the entry (nullable on legacy rows).
 */
export type WalletTransactionType = "deposit" | "withdraw" | "purchase" | "refund" | string
export type WalletTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | string

export type WalletTransaction = {
  id: number
  amount: number
  type: WalletTransactionType
  status: WalletTransactionStatus
  balance_before?: number
  balance_after?: number
  reference_order_id?: number
  description?: string
  created_at: string
}

/** The four backend types collapse into two ledger directions for the UI. */
export const CREDIT_TYPES = new Set<WalletTransactionType>(["deposit", "refund"])

/** True when a transaction adds to the balance (credit) vs. spends it (debit). */
export function isCreditTx(t: Pick<WalletTransaction, "type">): boolean {
  return CREDIT_TYPES.has(t.type)
}

export type WalletSummary = {
  id: number
  balance: number
  created_at?: string
  updated_at?: string
}

export function useWallet(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet,
    // GET /api/v1/wallet → response.OK → { data: WalletResponse }.
    queryFn: () => storeRequest<{ data: WalletSummary }>("wallet").then((b) => b.data),
    enabled,
  })
}

export type WalletTxParams = {
  /** Backend transaction type filter (deposit/withdraw/purchase/refund). */
  type?: WalletTransactionType
  page?: number
  limit?: number
}

/**
 * GET /api/v1/wallet/transactions — the ledger is paginated by the backend
 * (`response.Paginated` → `{ results, pagination }`). Returns the envelope so
 * callers can render running balances and a pager.
 */
export function useWalletTransactions(params: WalletTxParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.wallet, "transactions", params] as const,
    queryFn: () =>
      storeRequest<Paginated<WalletTransaction>>(
        `wallet/transactions${buildQuery(params)}`
      ),
    enabled,
    placeholderData: (prev) => prev,
  })
}

// ── Addresses (mutation — list/create live in hooks.ts) ──────────────────────

export function useUpdateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AddressInput }) =>
      storeRequest<{ data: Address }>(`addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => storeRequest<void>(`addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses }),
  })
}

export function useSetDefaultAddress() {
  const qc = useQueryClient()
  return useMutation({
    // TODO(api): confirm POST /api/v1/addresses/:id/default.
    mutationFn: (id: number) =>
      storeRequest<{ data: Address }>(`addresses/${id}/default`, { method: "POST" }).then(
        (b) => b.data
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses }),
  })
}

// ── Recommendations ──────────────────────────────────────────────────────────

/** Lightweight product shape returned by the recommendations endpoint. */
export type RecommendedProduct = {
  id: number
  title: string
  slug: string
  brand?: string
  image_url?: string
  min_price: number
  max_price?: number
}

export function useRecommendations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recommendations,
    // TODO(api): confirm GET /api/v1/recommendations shape ({ data: [...] }).
    queryFn: () =>
      storeRequest<{ data: RecommendedProduct[] }>("recommendations").then((b) => b.data),
    enabled,
  })
}

// ── Reviews (the customer's own) ─────────────────────────────────────────────

export type MyReview = {
  id: number
  product_id: number
  product_slug?: string
  product_title: string
  image_url?: string
  rating: number
  body: string
  status: "pending" | "approved" | "rejected" | string
  created_at: string
}

/** A delivered product the customer hasn't reviewed yet. */
export type PendingReviewItem = {
  product_id: number
  product_slug?: string
  product_title: string
  image_url?: string
  order_id: number
  delivered_at?: string
}

export const accountReviewKeys = {
  mine: ["account", "reviews", "mine"] as const,
  pending: ["account", "reviews", "pending"] as const,
}

export function useMyReviews(enabled = true) {
  return useQuery({
    queryKey: accountReviewKeys.mine,
    // TODO(api): confirm GET /api/v1/reviews?author=me shape.
    queryFn: () =>
      storeRequest<{ data: MyReview[] }>("reviews/mine").then((b) => b.data),
    enabled,
  })
}

export function usePendingReviews(enabled = true) {
  return useQuery({
    queryKey: accountReviewKeys.pending,
    // TODO(api): confirm GET /api/v1/reviews/pending (delivered, not-yet-reviewed).
    queryFn: () =>
      storeRequest<{ data: PendingReviewItem[] }>("reviews/pending").then((b) => b.data),
    enabled,
  })
}

export function useDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => storeRequest<void>(`reviews/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountReviewKeys.mine }),
  })
}

// ── Profile ───────────────────────────────────────────────────────────────

/**
 * The authenticated user's profile, mirroring the backend `UserResponse`
 * (GET /api/v1/auth/me). `email` is read-only on this route — it is shown but
 * never editable here.
 */
export type Profile = {
  user_id: string
  first_name?: string
  last_name?: string
  email: string
  phone?: string
  birth_date?: string
  gender?: "male" | "female" | "other" | string
  role: string
  created_at: string
}

export const profileKey = ["auth", "me"] as const

/** GET /api/v1/auth/me — seeds the profile form from the source of truth. */
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: profileKey,
    queryFn: () => storeRequest<{ data: Profile }>("auth/me").then((b) => b.data),
    enabled,
  })
}

/**
 * Fields the self-service PATCH /api/v1/auth/me route actually accepts
 * (`UpdateUserReq`). Note: e-mail is NOT editable here, and password changes go
 * through the dedicated reset flow — neither is sent from this hook.
 */
export type ProfileInput = {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    // PATCH /api/v1/auth/me → response.OK → { data: UserResponse }.
    mutationFn: (input: ProfileInput) =>
      storeRequest<{ data: Profile }>("auth/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((b) => b.data),
    onSuccess: (profile) => {
      qc.setQueryData(profileKey, profile)
    },
  })
}
