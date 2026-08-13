import "server-only";

import { apiFetch } from "@/lib/api/client";

import type { LoyaltyProgramme } from "../types";

export function getLoyaltyProgramme(): Promise<LoyaltyProgramme> {
  return apiFetch<LoyaltyProgramme>("/admin/loyalty/programme");
}
