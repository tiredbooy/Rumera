"use client"

/**
 * Admin React Query hooks.
 *
 * Today these resolve the in-memory mock from `lib/admin/data.ts` so client
 * components can already render against a real query lifecycle (loading / data).
 * When the `GET /api/v1/admin/*` endpoints land, replace each `queryFn` body
 * with an `apiClient` call — the keys, signatures and call-sites stay the same.
 *
 * Server components should read `lib/admin/data.ts` directly (they already run
 * on the server); these hooks are for interactive client surfaces only.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  adminOrders,
  adminCustomers,
  adminReviews,
  adminRecipes,
  inventory,
  getOrder,
  getCustomer,
  type ReviewStatus,
} from "@/lib/admin/data"
import {
  createProduct,
  updateProduct,
  listProductImages,
  reorderProductImages,
  setPrimaryImage,
  updateImageAlt,
  deleteProductImage,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/api/admin-client"

export const adminKeys = {
  orders: (params?: Record<string, unknown>) => ["admin", "orders", params ?? {}] as const,
  order: (id: string) => ["admin", "orders", "detail", id] as const,
  customers: (params?: Record<string, unknown>) => ["admin", "customers", params ?? {}] as const,
  customer: (id: string) => ["admin", "customers", "detail", id] as const,
  inventory: () => ["admin", "inventory"] as const,
  reviews: (status?: ReviewStatus | "all") => ["admin", "reviews", status ?? "all"] as const,
  recipes: () => ["admin", "recipes"] as const,
} as const

// TODO(api): swap each resolver for an apiClient.get(...) against /api/v1/admin/*.
const resolve = <T>(value: T) => Promise.resolve(value)

export function useAdminOrders() {
  return useQuery({ queryKey: adminKeys.orders(), queryFn: () => resolve(adminOrders) })
}

export function useAdminOrder(id: string) {
  return useQuery({ queryKey: adminKeys.order(id), queryFn: () => resolve(getOrder(id) ?? null) })
}

export function useAdminCustomers() {
  return useQuery({ queryKey: adminKeys.customers(), queryFn: () => resolve(adminCustomers) })
}

export function useAdminCustomer(id: string) {
  return useQuery({
    queryKey: adminKeys.customer(id),
    queryFn: () => resolve(getCustomer(id) ?? null),
  })
}

export function useAdminInventory() {
  return useQuery({ queryKey: adminKeys.inventory(), queryFn: () => resolve(inventory) })
}

export function useAdminReviews(status: ReviewStatus | "all" = "all") {
  return useQuery({
    queryKey: adminKeys.reviews(status),
    queryFn: () =>
      resolve(status === "all" ? adminReviews : adminReviews.filter((r) => r.status === status)),
  })
}

export function useAdminRecipes() {
  return useQuery({ queryKey: adminKeys.recipes(), queryFn: () => resolve(adminRecipes) })
}

// ── Products & images (real backend via the /api/admin BFF proxy) ─────────────

export const productKeys = {
  images: (productId: number) => ["admin", "products", productId, "images"] as const,
}

export function useCreateProduct() {
  return useMutation({ mutationFn: (input: CreateProductInput) => createProduct(input) })
}

export function useUpdateProduct(id: number) {
  return useMutation({ mutationFn: (input: UpdateProductInput) => updateProduct(id, input) })
}

export function useProductImages(productId: number, enabled = true) {
  return useQuery({
    queryKey: productKeys.images(productId),
    queryFn: () => listProductImages(productId),
    enabled: enabled && productId > 0,
  })
}

export function useReorderProductImages(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => reorderProductImages(productId, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.images(productId) }),
  })
}

export function useSetPrimaryImage(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (imageId: number) => setPrimaryImage(productId, imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.images(productId) }),
  })
}

export function useUpdateImageAlt(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ imageId, altText }: { imageId: number; altText: string }) =>
      updateImageAlt(productId, imageId, altText),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.images(productId) }),
  })
}

export function useDeleteProductImage(productId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (imageId: number) => deleteProductImage(productId, imageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.images(productId) }),
  })
}
