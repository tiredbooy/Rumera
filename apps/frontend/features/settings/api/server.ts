import "server-only";

import { cache } from "react";

import { apiFetch } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";
import { SETTINGS_CACHE_TAG } from "@/lib/cache-tags";

import type { PublicSiteSettings, SiteSettings } from "../types";

/**
 * The storefront layout awaits this on every public page, so inheriting
 * publicRequest's `no-store` default made the whole site dynamic.
 *
 * Admin settings writes revalidate SETTINGS_CACHE_TAG (see admin-revalidation.ts),
 * which is what keeps the maintenance kill switch instant. The short TTL is only a
 * backstop for settings changed outside the admin BFF — deliberately far below the
 * 3600s used for catalogue data, because closing or reopening the shop is the thing
 * that goes stale here.
 */
export const getPublicSiteSettings = cache(
  function getPublicSiteSettings(): Promise<PublicSiteSettings> {
    return publicRequest<PublicSiteSettings>("/settings", {
      cache: "force-cache",
      next: { revalidate: 300, tags: [SETTINGS_CACHE_TAG] },
    });
  },
);

/** Header/footer must not 500 the public site when settings are down. */
export const getPublicSiteSettingsOrNull = cache(
  async function getPublicSiteSettingsOrNull(): Promise<PublicSiteSettings | null> {
    try {
      return await getPublicSiteSettings();
    } catch {
      return null;
    }
  },
);

export function getAdminSiteSettings(): Promise<SiteSettings> {
  return apiFetch<SiteSettings>("/admin/settings");
}
