import "server-only";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function requireShippingAdmin(callbackUrl = "/admin/shipping") {
  return requirePermission(PERMISSIONS.SHIPPING_MANAGE, callbackUrl);
}
