import type { MaintenanceSettings } from "@/features/settings/types";

const FALLBACK_MESSAGE = "در حال تعمیر";

/** Visible maintenance copy when the shop is closed. Empty message → fallback. */
export function presentMaintenanceCopy(
  maintenance?: Partial<MaintenanceSettings> | null,
): string | null {
  if (!maintenance?.enabled) return null;

  if (typeof maintenance.message === "string") {
    const trimmed = maintenance.message.trim();
    if (trimmed) return trimmed;
  }

  return FALLBACK_MESSAGE;
}
