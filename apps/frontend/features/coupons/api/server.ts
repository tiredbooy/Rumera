import "server-only";

import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";

import type { Coupon, CouponListQuery } from "../types";

export function listAdminCoupons(
  query: CouponListQuery = {},
): Promise<Paginated<Coupon>> {
  return apiFetch<Paginated<Coupon>>(
    `/admin/coupons${buildQueryString(query)}`,
  );
}
