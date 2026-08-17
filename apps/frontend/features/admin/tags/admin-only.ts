import "server-only";

import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function requireTagAdmin(callbackUrl = "/admin/tags") {
  return requirePermission(PERMISSIONS.TAGS_MANAGE, callbackUrl);
}
