import "server-only";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function requireGiftCardAdmin(
  callbackUrl = "/admin/gift-cards",
) {
  return requirePermission(PERMISSIONS.GIFT_CARDS_ISSUE, callbackUrl);
}
