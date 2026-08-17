import "server-only";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function requirePaymentAdmin(callbackUrl = "/admin/payments") {
  return requirePermission(PERMISSIONS.PAYMENTS_READ, callbackUrl);
}
