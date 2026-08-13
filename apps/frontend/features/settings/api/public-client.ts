import type { ApiSuccess } from "@/lib/api/types";

import type { PublicSiteSettings } from "../types";
import { normalizeSiteSettings } from "../form-utils";

/** Browser fetch of public GET /settings via BFF (no auth). */
export async function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  const response = await fetch("/api/public/settings", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | ApiSuccess<PublicSiteSettings>
    | null;

  if (!response.ok) {
    throw new Error("دریافت تنظیمات فروشگاه ناموفق بود");
  }

  const raw = body?.data ?? (body as unknown as PublicSiteSettings);
  const full = normalizeSiteSettings(raw as Partial<PublicSiteSettings>);
  // Public contract omits admin-only updatedAt.
  const { updatedAt: _u, ...publicDoc } = full;
  return publicDoc;
}
