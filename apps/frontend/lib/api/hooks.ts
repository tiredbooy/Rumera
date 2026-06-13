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
