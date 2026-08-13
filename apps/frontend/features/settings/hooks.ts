"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPublicSiteSettings } from "./api/public-client";
import type { GiftCheckoutSettings } from "./types";

export const publicSettingsKeys = {
  all: ["public-settings"] as const,
};

export function usePublicGiftSettings() {
  return useQuery({
    queryKey: publicSettingsKeys.all,
    queryFn: fetchPublicSiteSettings,
    select: (data): GiftCheckoutSettings => data.gift,
    staleTime: 60_000,
  });
}
