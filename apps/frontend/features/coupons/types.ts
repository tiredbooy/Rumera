import type { PaginationQuery } from "@/lib/api/types";

export type DiscountType =
  | "percentage"
  | "fixed_amount"
  | "free_shipping";

export interface CouponApplicability {
  category_ids?: number[];
  product_ids?: number[];
}

/** Canonical coupon entity returned by admin reads and mutations. */
export interface Coupon {
  id: number;
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount: number;
  max_uses?: number;
  max_uses_per_user: number;
  applicable_to?: CouponApplicability;
  is_active: boolean;
  starts_at: string;
  expires_at?: string;
  total_uses: number;
}

export interface CreateCouponInput {
  code: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
  max_uses?: number | null;
  max_uses_per_user: number;
  applicable_to?: CouponApplicability | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  expires_at?: string | null;
}

/** JSON null and omission both decode to nil pointers in the current PATCH DTO. */
export interface UpdateCouponInput {
  description?: string | null;
  discount_value?: number | null;
  max_discount_amount?: number | null;
  min_order_amount?: number | null;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  applicable_to?: CouponApplicability | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  expires_at?: string | null;
}

export interface ValidateCouponInput {
  code: string;
  order_subtotal: number;
  product_ids?: number[] | null;
  category_ids?: number[] | null;
}

/**
 * Backend defect: validation embeds the untagged persistence model, so this
 * nested object is PascalCase and differs from canonical `Coupon`.
 */
export interface LegacyCouponValidationCoupon {
  ID: number;
  Code: string;
  Description: string | null;
  DiscountType: DiscountType;
  DiscountValue: number;
  MaxDiscountAmount: number | null;
  MinOrderAmount: number;
  MaxUses: number | null;
  MaxUsesPerUser: number;
  ApplicableTo: CouponApplicability | null;
  IsActive: boolean;
  StartsAt: string;
  ExpiresAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export type CouponValidation =
  | {
      coupon: LegacyCouponValidationCoupon;
      discount_amount: number;
      free_shipping: boolean;
      is_valid: true;
      invalid_reason?: never;
    }
  | {
      coupon: null;
      discount_amount: number;
      free_shipping: false;
      is_valid: false;
      invalid_reason: string;
    };

export type CouponSortField =
  | "created_at"
  | "code"
  | "discount_value"
  | "starts_at"
  | "expires_at";

export interface CouponListQuery extends PaginationQuery {
  sortBy?: CouponSortField;
  orderBy?: "asc" | "desc";
  search?: string;
  is_active?: boolean;
  discount_type?: DiscountType;
  active_only?: boolean;
}
