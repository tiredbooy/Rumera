/**
 * Typed models mirroring the Go API (`apps/backend/docs/api/*`). Field names
 * match the backend exactly. Single resources arrive under `{ data }`; lists
 * under `{ results, pagination }` (see `Paginated`).
 */

export type Pagination = {
  page: number
  limit: number
  total_items: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export type Paginated<T> = {
  results: T[]
  pagination: Pagination
}

// ── Catalogue ────────────────────────────────────────────────────────────────

export type ProductListItem = {
  id: number
  title: string
  code?: string
  slug: string
  brand?: string
  is_active: boolean
  min_price: number
  max_price: number
}

export type ProductImage = {
  id: number
  image_url: string
  alt_text?: string
  sort_order: number
  is_primary: boolean
}

export type Variant = {
  id: number
  sku: string
  price: number
  compare_at_price?: number
  is_active: boolean
  options?: { id: number; option_type: string; value: string }[]
  images?: ProductImage[]
}

export type ProductDetail = {
  id: number
  title: string
  code?: string
  slug: string
  category_id?: number
  description?: string
  brand_id?: number
  country_of_origin?: string
  abv?: number
  weight?: number
  is_active: boolean
  meta_title?: string
  meta_description?: string
  meta_tags?: string[]
  tags?: { id: number; title: string }[]
  images?: ProductImage[]
  variants?: Variant[]
}

export type Category = {
  id: number
  name: string
  description?: string
  parent_id?: number
  slug: string
  children?: Category[]
}

// ── Wishlist ─────────────────────────────────────────────────────────────────

export type WishlistItem = {
  id: number // wishlist-item row id (use for DELETE /wishlist/items/:id)
  product_id: number
  product_title: string
  variant_id: number
  sku?: string
  price: number
  compare_at_price?: number
  image_url?: string
  options?: { name: string; value: string }[]
  is_in_stock: boolean
  added_at: string
}

export type Wishlist = {
  id: number
  items: WishlistItem[]
  total: number
}

export type Brand = {
  id: number
  title: string
  country?: string
  founded_year?: number
  image_url?: string
  description?: string
}

// ── Cart ─────────────────────────────────────────────────────────────────────

export type CartItem = {
  id: number
  product_id: number
  product_title: string
  variant_id: number
  sku: string
  unit_price_snapshot: number
  current_price: number
  price_changed: boolean
  quantity: number
  line_total: number
  image_url?: string
  options?: { name: string; value: string }[]
}

export type CartSummary = {
  total_items: number
  unique_items: number
  subtotal: number
  discount_total: number
}

export type Cart = {
  id: number
  items: CartItem[]
  summary: CartSummary
}

// ── Addresses ────────────────────────────────────────────────────────────────

export type Address = {
  id: number
  title?: string
  full_name: string
  phone_number?: string
  address_line1: string
  address_line2?: string
  city: string
  state_province?: string
  postal_code: string
  country: string
  is_default?: boolean
}

export type AddressInput = Omit<Address, "id">

// ── Shipping ─────────────────────────────────────────────────────────────────

export type ShippingMethod = {
  id: number
  name: string
  carrier?: string
  rate_type: "flat_rate" | "per_kg" | "percentage" | "free"
  base_rate: number
  free_above_amount?: number
  min_delivery_days?: number
  max_delivery_days?: number
  is_active: boolean
  estimated_cost: number
}

// ── Coupons ──────────────────────────────────────────────────────────────────

export type CouponValidation = {
  coupon: {
    id: number
    code: string
    discount_type: "percentage" | "fixed" | string
    discount_value: number
  }
  discount_amount: number
  free_shipping: boolean
  is_valid: boolean
  invalid_reason: string
}

// ── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "payment_failed"
  | "paid"
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "refund_requested"
  | "refund_approved"
  | "refunded"
  | "partially_refunded"
  | "cancelled"

export type PaymentMethod = "card" | "crypto" | "bank_transfer" | "wallet" | "gateway"

export type OrderItem = {
  id: number
  product_id: number
  variant_id: number
  product_title: string
  image_url?: string
  quantity: number
  unit_price: number
  total_price: number
}

export type Order = {
  id: number
  status: OrderStatus
  payment_method: PaymentMethod
  subtotal: number
  discount_amount: number
  shipping_cost: number
  tax_amount: number
  total_amount: number
  notes?: string
  is_gift?: boolean
  gift_message?: string
  gift_wrap?: boolean
  hide_price?: boolean
  scheduled_delivery_date?: string
  created_at: string
  items: OrderItem[]
}

export type OrderListItem = {
  id: number
  status: OrderStatus
  payment_method: PaymentMethod
  total_amount: number
  item_count: number
  created_at: string
}

export type PlaceOrderInput = {
  address_id: number
  payment_method: PaymentMethod
  shipping_method_id: number
  coupon_code?: string
  notes?: string
  is_gift?: boolean
  gift_message?: string
  gift_wrap?: boolean
  hide_price?: boolean
  scheduled_delivery_date?: string
}
