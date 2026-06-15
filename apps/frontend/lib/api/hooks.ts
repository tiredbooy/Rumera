"use client"

/**
 * React Query hooks over the BFF proxy (`/api/store/*`). These power every
 * authenticated, mutable surface — cart, addresses, coupons, shipping, orders.
 * Keys come from `query-keys.ts`; cart mutations seed the cache with the fresh
 * CartResponse the API returns so the UI updates without an extra round-trip.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "./query-keys"
import { buildQuery } from "./qs"
import { storeRequest } from "./store-client"
import type {
  Address,
  AddressInput,
  Cart,
  CouponValidation,
  Order,
  OrderListItem,
  Paginated,
  PlaceOrderInput,
  ShippingMethod,
} from "@/lib/catalog/types"

// ── Cart ─────────────────────────────────────────────────────────────────────

export function useCart(enabled = true) {
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => storeRequest<{ data: Cart }>("cart").then((b) => b.data),
    enabled,
  })
}

export function useAddCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { product_variant_id: number; quantity: number }) =>
      storeRequest<{ data: Cart }>("cart/items", {
        method: "POST",
        body: JSON.stringify(vars),
      }).then((b) => b.data),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),
  })
}

/** Result of POST /cart/items/bulk — refreshed cart + per-variant skip list. */
export type BulkAddResult = {
  cart: Cart
  added: number
  skipped: { product_variant_id: number; reason: "invalid" | "not_found" | "unavailable" }[]
}

/** Add many variants at once (e.g. all of a recipe's ingredients). */
export function useBulkAddCartItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { product_variant_id: number; quantity: number }[]) =>
      storeRequest<{ data: BulkAddResult }>("cart/items/bulk", {
        method: "POST",
        body: JSON.stringify({ items }),
      }).then((b) => b.data),
    onSuccess: (res) => qc.setQueryData(queryKeys.cart, res.cart),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      storeRequest<{ data: Cart }>(`cart/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      }).then((b) => b.data),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      storeRequest<{ data: Cart }>(`cart/items/${itemId}`, { method: "DELETE" }).then(
        (b) => b.data
      ),
    onSuccess: (cart) => qc.setQueryData(queryKeys.cart, cart),
  })
}

export function useClearCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => storeRequest<void>("cart", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.cart }),
  })
}

// ── Product alerts (restock / price-drop) ────────────────────────────────────

export type ProductAlert = {
  id: number
  product_variant_id: number
  alert_type: "restock" | "price_drop"
  target_price?: number
  notified_at?: string | null
  created_at: string
}

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => storeRequest<{ data: ProductAlert[] }>("alerts").then((b) => b.data),
    enabled,
  })
}

export function useCreateAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      product_variant_id: number
      alert_type: "restock" | "price_drop"
      target_price?: number
    }) =>
      storeRequest<{ data: ProductAlert }>("alerts", {
        method: "POST",
        body: JSON.stringify(vars),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  })
}

export function useDeleteAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => storeRequest<void>(`alerts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  })
}

// ── Loyalty (Cellar Club) ────────────────────────────────────────────────────

export type Loyalty = {
  points_balance: number
  lifetime_points: number
  tier: string
  next_tier?: string
  points_to_next: number
}
export type LoyaltyTx = { delta: number; reason: string; created_at: string }

export function useLoyalty(enabled = true) {
  return useQuery({
    queryKey: ["loyalty"],
    queryFn: () => storeRequest<{ data: Loyalty }>("loyalty").then((b) => b.data),
    enabled,
  })
}

export function useLoyaltyTransactions(enabled = true) {
  return useQuery({
    queryKey: ["loyalty", "transactions"],
    queryFn: () =>
      storeRequest<{ data: LoyaltyTx[] }>("loyalty/transactions").then((b) => b.data),
    enabled,
  })
}

export function useRedeemPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (points: number) =>
      storeRequest<{ data: Loyalty }>("loyalty/redeem", {
        method: "POST",
        body: JSON.stringify({ points }),
      }).then((b) => b.data),
    onSuccess: (l) => {
      qc.setQueryData(["loyalty"], l)
      qc.invalidateQueries({ queryKey: ["loyalty", "transactions"] })
      qc.invalidateQueries({ queryKey: ["wallet"] })
    },
  })
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export type Subscription = {
  id: number
  plan: string
  cadence: "monthly" | "quarterly"
  status: "active" | "paused" | "cancelled"
  next_renewal_at: string
  created_at: string
}

export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => storeRequest<{ data: Subscription[] }>("subscriptions").then((b) => b.data),
    enabled,
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cadence: "monthly" | "quarterly") =>
      storeRequest<{ data: Subscription }>("subscriptions", {
        method: "POST",
        body: JSON.stringify({ cadence }),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "pause" | "resume" | "cancel" | "skip" }) =>
      storeRequest<{ data: Subscription }>(`subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  })
}

// ── Gift cards ───────────────────────────────────────────────────────────────

export function useRedeemGiftCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      storeRequest<{ data: { amount: number } }>("gift-cards/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  })
}

// ── Referrals ────────────────────────────────────────────────────────────────

export type Referral = { code: string; pending: number; completed: number; reward: number }

export function useReferral(enabled = true) {
  return useQuery({
    queryKey: ["referral"],
    queryFn: () => storeRequest<{ data: Referral }>("referrals/me").then((b) => b.data),
    enabled,
  })
}

export function useClaimReferral() {
  return useMutation({
    mutationFn: (code: string) =>
      storeRequest<void>("referrals/claim", { method: "POST", body: JSON.stringify({ code }) }),
  })
}

// ── Taste profile (personalisation) ──────────────────────────────────────────

export type TastePrefs = {
  categories: string[]
  budget_max: number
  flavor: string[]
  occasions: string[]
}

export function useTasteProfile(enabled = true) {
  return useQuery({
    queryKey: ["taste-profile"],
    queryFn: () =>
      storeRequest<{ data: TastePrefs }>("me/taste-profile").then((b) => b.data),
    enabled,
  })
}

export function useSaveTasteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: TastePrefs) =>
      storeRequest<{ data: TastePrefs }>("me/taste-profile", {
        method: "PUT",
        body: JSON.stringify(prefs),
      }).then((b) => b.data),
    onSuccess: (p) => qc.setQueryData(["taste-profile"], p),
  })
}

// ── Addresses ────────────────────────────────────────────────────────────────

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => storeRequest<{ data: Address[] }>("addresses").then((b) => b.data),
    enabled,
  })
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddressInput) =>
      storeRequest<{ data: Address }>("addresses", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((b) => b.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.addresses }),
  })
}

// ── Shipping ─────────────────────────────────────────────────────────────────

export function useShippingMethods(region: string, weight: number, enabled = true) {
  return useQuery({
    queryKey: ["shipping", region, weight],
    queryFn: () =>
      storeRequest<{ data: ShippingMethod[] }>(
        `shipping/available${buildQuery({ region, weight })}`
      ).then((b) => b.data),
    enabled: enabled && !!region,
  })
}

// ── Coupons ──────────────────────────────────────────────────────────────────

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (vars: {
      code: string
      order_subtotal: number
      product_ids?: number[]
      category_ids?: number[]
    }) =>
      storeRequest<{ data: CouponValidation }>("coupons/validate", {
        method: "POST",
        body: JSON.stringify(vars),
      }).then((b) => b.data),
  })
}

// ── Orders ───────────────────────────────────────────────────────────────────

export function usePlaceOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaceOrderInput) =>
      storeRequest<{ data: Order }>("orders", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((b) => b.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cart })
      qc.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
  })
}

export function useOrders(params: { page?: number; status?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => storeRequest<Paginated<OrderListItem>>(`orders${buildQuery(params)}`),
    enabled,
  })
}

export function useOrder(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => storeRequest<{ data: Order }>(`orders/${id}`).then((b) => b.data),
    enabled,
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => storeRequest<void>(`orders/${id}/cancel`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orders.all }),
  })
}
