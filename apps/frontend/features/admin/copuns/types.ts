// types/coupon.ts
import { BaseFilter } from "@/lib/types/filters";

// ------------------------------------------------
// Enums / string unions
// ------------------------------------------------

export type DiscountType = "percentage" | "fixed_amount" | "free_shipping";

// ------------------------------------------------
// Nested types
// ------------------------------------------------

export interface ApplicableTo {
  category_ids?: number[]; // optional, omitted when empty
  product_ids?: number[]; // optional, omitted when empty
}

// ------------------------------------------------
// Response types
// ------------------------------------------------

export interface CouponResponse {
  id: number;
  code: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
  max_uses?: number | null;
  max_uses_per_user: number;
  applicable_to?: ApplicableTo | null; // may be omitted or null
  is_active: boolean;
  starts_at: string; // ISO datetime
  expires_at?: string | null; // ISO datetime
  total_uses: number; // aggregated from coupon_usages
}

// ------------------------------------------------
// Request payloads
// ------------------------------------------------

export interface CreateCouponReq {
  code: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
  max_uses?: number | null;
  max_uses_per_user?: number; // default might be set; optional in request?
  applicable_to?: ApplicableTo | null;
  is_active?: boolean;
  starts_at?: string | null; // ISO datetime
  expires_at?: string | null; // ISO datetime
}

export interface UpdateCouponReq {
  description?: string | null;
  discount_value?: number | null;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  applicable_to?: ApplicableTo | null;
  is_active?: boolean;
  starts_at?: string | null;
  expires_at?: string | null;
}

export interface ValidateCouponReq {
  code: string;
  order_subtotal: number;
  product_ids?: number[];
  category_ids?: number[];
}

// ------------------------------------------------
// Validation result
// ------------------------------------------------

export interface CouponValidationResult {
  coupon: CouponResponse; // or a minimal coupon object, but we reuse CouponResponse
  discount_amount: number;
  free_shipping: boolean;
  is_valid: boolean;
  invalid_reason?: string;
}

// ------------------------------------------------
// Coupon usage (if needed for admin)
// ------------------------------------------------

export interface CouponUsage {
  id: number;
  coupon_id: number;
  user_id: number;
  order_id: number;
  discount_applied: number;
  used_at: string; // ISO datetime
}

// ------------------------------------------------
// Filter (extends BaseFilter)
// ------------------------------------------------

export interface CouponFilter extends BaseFilter {
  is_active?: boolean;
  discount_type?: DiscountType;
  active_only?: boolean; // if true, only active coupons (now + future)
}
