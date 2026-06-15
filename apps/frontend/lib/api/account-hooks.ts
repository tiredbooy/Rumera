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
import { storeRequest } from "./store-client"
import type { Address, AddressInput } from "@/lib/catalog/types"

// ── Wallet ─────────────────────────────────────────────────────────────────

/** A single wallet ledger entry. `amount` is signed (+credit / −debit). */
export type WalletTransaction = {
  id: number
  kind: "topup" | "spend" | "refund" | "gift" | "reward" | string
  amount: number
  description?: string
  balance_after?: number
  created_at: string
}

export type WalletSummary = {
  balance: number
  currency?: string
}

export function useWallet(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet,
    // TODO(api): confirm GET /api/v1/wallet shape ({ data: { balance } }).
    queryFn: () => storeRequest<{ data: WalletSummary }>("wallet").then((b) => b.data),
    enabled,
  })
}

export function useWalletTransactions(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.wallet, "transactions"] as const,
    // TODO(api): confirm GET /api/v1/wallet/transactions shape ({ data: [...] }).
    queryFn: () =>
      storeRequest<{ data: WalletTransaction[] }>("wallet/transactions").then((b) => b.data),
    enabled,
  })
}

export function useTopUpWallet() {
  const qc = useQueryClient()
  return useMutation({
    // TODO(api): wire to POST /api/v1/wallet/topup (gateway intent).
    mutationFn: (amount: number) =>
      storeRequest<{ data: WalletSummary }>("wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.wallet }),
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

export type ProfileInput = {
  name?: string
  email?: string
  phone_number?: string
}

export function useUpdateProfile() {
  return useMutation({
    // TODO(api): wire to PATCH /api/v1/auth/me.
    mutationFn: (input: ProfileInput) =>
      storeRequest<{ data: unknown }>("auth/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  })
}
