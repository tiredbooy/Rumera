import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  getAdminRevalidationPlan,
  type AdminRevalidationPlan,
} from "@/lib/admin-revalidation";

/** Apply tags and paths from a plan (BFF proxy or server actions). */
export function applyAdminRevalidationPlan(plan: AdminRevalidationPlan): void {
  for (const tag of plan.tags) {
    revalidateTag(tag, { expire: 0 });
  }
  for (const entry of plan.paths) {
    revalidatePath(entry.path, entry.type);
  }
}

/**
 * Map an admin mutation onto storefront cache invalidation.
 * Safe to call after a successful upstream write; empty plans are no-ops.
 */
export function revalidateAfterAdminMutation(
  segments: string[],
  method: string,
  status: number,
): AdminRevalidationPlan {
  const plan = getAdminRevalidationPlan(segments, method, status);
  applyAdminRevalidationPlan(plan);
  return plan;
}
