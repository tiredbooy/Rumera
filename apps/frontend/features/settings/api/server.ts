import "server-only";

import { apiFetch } from "@/lib/api/client";
import { publicRequest } from "@/lib/api/public";

import type { PublicSiteSettings, SiteSettings } from "../types";

/** Backend cache invalidation controls storefront settings freshness. */
export function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  return publicRequest<PublicSiteSettings>("/settings");
}

export function getAdminSiteSettings(): Promise<SiteSettings> {
  return apiFetch<SiteSettings>("/admin/settings");
}
