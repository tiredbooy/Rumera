import "server-only";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function requireCouponAdmin(callbackUrl = "/admin/coupons") {
  return requirePermission(PERMISSIONS.COUPONS_MANAGE, callbackUrl);
}
