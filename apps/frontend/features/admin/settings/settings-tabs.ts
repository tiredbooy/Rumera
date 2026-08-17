import type { FieldErrors } from "react-hook-form";

import type { SiteSettingsFormValues } from "@/features/settings/validations";

export const SETTINGS_TABS = [
  "store",
  "contact",
  "social",
  "shipping",
  "gift",
  "seo",
  "maintenance",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

const FIELD_TAB: Record<string, SettingsTab> = {
  name: "store",
  tagline: "store",
  logoUrl: "store",
  description: "store",
  supportEmail: "contact",
  supportPhone: "contact",
  address: "contact",
  workingHours: "contact",
  instagram: "social",
  telegram: "social",
  whatsapp: "social",
  twitter: "social",
  youtube: "social",
  linkedin: "social",
  freeThreshold: "shipping",
  note: "shipping",
  defaultTitle: "seo",
  defaultDescription: "seo",
  ogImage: "seo",
  keywords: "seo",
  enabled: "maintenance",
  message: "maintenance",
  giftEnabled: "gift",
  giftMessageEnabled: "gift",
  giftHidePriceEnabled: "gift",
  giftOptions: "gift",
};

export function settingsTabForField(name: string): SettingsTab | undefined {
  if (name.startsWith("giftOptions")) return "gift";
  return FIELD_TAB[name];
}

export function firstSettingsTabWithErrors(
  errors: FieldErrors<SiteSettingsFormValues>,
): SettingsTab | null {
  const names = Object.keys(errors);
  if (names.length === 0) return null;
  for (const tab of SETTINGS_TABS) {
    if (names.some((name) => settingsTabForField(name) === tab)) return tab;
  }
  return null;
}

export function settingsTabsWithErrors(
  errors: FieldErrors<SiteSettingsFormValues>,
): Set<SettingsTab> {
  const tabs = new Set<SettingsTab>();
  for (const name of Object.keys(errors)) {
    const tab = settingsTabForField(name);
    if (tab) tabs.add(tab);
  }
  return tabs;
}
