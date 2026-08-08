import type { ApiFieldErrors } from "@/lib/api/types";

import type {
  SiteSettings,
  UpdateSiteSettingsInput,
} from "./types";
import type { SiteSettingsFormValues } from "./validations";

/** Backend json field name → flat form field. Used to map 422 errors onto inputs. */
export const SETTINGS_FIELD_KEYS = new Set<keyof SiteSettingsFormValues>([
  "name",
  "tagline",
  "logoUrl",
  "description",
  "supportEmail",
  "supportPhone",
  "address",
  "workingHours",
  "instagram",
  "telegram",
  "whatsapp",
  "twitter",
  "youtube",
  "linkedin",
  "freeThreshold",
  "note",
  "defaultTitle",
  "defaultDescription",
  "ogImage",
  "keywords",
  "enabled",
  "message",
]);

const EMPTY_SETTINGS: SiteSettings = {
  store: { name: "", tagline: "", logoUrl: "", description: "" },
  contact: {
    supportEmail: "",
    supportPhone: "",
    address: "",
    workingHours: "",
  },
  social: {
    instagram: "",
    telegram: "",
    whatsapp: "",
    twitter: "",
    youtube: "",
    linkedin: "",
  },
  shipping: { freeThreshold: 0, note: "" },
  seo: {
    defaultTitle: "",
    defaultDescription: "",
    ogImage: "",
    keywords: "",
  },
  maintenance: { enabled: false, message: "" },
  updatedAt: "",
};

/** Normalize a settings document so form defaults never crash on partial data. */
export function normalizeSiteSettings(
  settings: Partial<SiteSettings> | null | undefined,
): SiteSettings {
  if (!settings || typeof settings !== "object") {
    return { ...EMPTY_SETTINGS };
  }
  return {
    store: { ...EMPTY_SETTINGS.store, ...settings.store },
    contact: { ...EMPTY_SETTINGS.contact, ...settings.contact },
    social: { ...EMPTY_SETTINGS.social, ...settings.social },
    shipping: {
      freeThreshold:
        typeof settings.shipping?.freeThreshold === "number" &&
        Number.isFinite(settings.shipping.freeThreshold)
          ? settings.shipping.freeThreshold
          : 0,
      note: settings.shipping?.note ?? "",
    },
    seo: { ...EMPTY_SETTINGS.seo, ...settings.seo },
    maintenance: {
      enabled: Boolean(settings.maintenance?.enabled),
      message: settings.maintenance?.message ?? "",
    },
    updatedAt: settings.updatedAt ?? "",
  };
}

export function defaultsFromSettings(
  s: SiteSettings,
): SiteSettingsFormValues {
  const n = normalizeSiteSettings(s);
  return {
    name: n.store.name ?? "",
    tagline: n.store.tagline ?? "",
    logoUrl: n.store.logoUrl ?? "",
    description: n.store.description ?? "",
    supportEmail: n.contact.supportEmail ?? "",
    supportPhone: n.contact.supportPhone ?? "",
    address: n.contact.address ?? "",
    workingHours: n.contact.workingHours ?? "",
    instagram: n.social.instagram ?? "",
    telegram: n.social.telegram ?? "",
    whatsapp: n.social.whatsapp ?? "",
    twitter: n.social.twitter ?? "",
    youtube: n.social.youtube ?? "",
    linkedin: n.social.linkedin ?? "",
    freeThreshold:
      n.shipping.freeThreshold != null && n.shipping.freeThreshold > 0
        ? String(n.shipping.freeThreshold)
        : n.shipping.freeThreshold === 0
          ? "0"
          : "",
    note: n.shipping.note ?? "",
    defaultTitle: n.seo.defaultTitle ?? "",
    defaultDescription: n.seo.defaultDescription ?? "",
    ogImage: n.seo.ogImage ?? "",
    keywords: n.seo.keywords ?? "",
    enabled: n.maintenance.enabled ?? false,
    message: n.maintenance.message ?? "",
  };
}

/** Flat form values → full wholesale-replace payload (every group). */
export function toSettingsPayload(
  v: SiteSettingsFormValues,
): UpdateSiteSettingsInput {
  const thresholdRaw = v.freeThreshold.trim();
  const freeThreshold =
    thresholdRaw === ""
      ? 0
      : Number.isFinite(Number(thresholdRaw))
        ? Math.trunc(Number(thresholdRaw))
        : 0;

  return {
    store: {
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      logoUrl: v.logoUrl.trim(),
      description: v.description,
    },
    contact: {
      supportEmail: v.supportEmail.trim(),
      supportPhone: v.supportPhone.trim(),
      address: v.address,
      workingHours: v.workingHours.trim(),
    },
    social: {
      instagram: v.instagram.trim(),
      telegram: v.telegram.trim(),
      whatsapp: v.whatsapp.trim(),
      twitter: v.twitter.trim(),
      youtube: v.youtube.trim(),
      linkedin: v.linkedin.trim(),
    },
    shipping: {
      freeThreshold,
      note: v.note,
    },
    seo: {
      defaultTitle: v.defaultTitle.trim(),
      defaultDescription: v.defaultDescription,
      ogImage: v.ogImage.trim(),
      keywords: v.keywords,
    },
    maintenance: {
      enabled: v.enabled,
      message: v.message,
    },
  };
}

/**
 * Map backend 422 field keys onto flat form fields.
 * Accepts `supportPhone`, `contact.supportPhone`, or `Contact.SupportPhone`.
 */
export function mapSettingsFieldErrors(
  fields: ApiFieldErrors | undefined,
): Partial<Record<keyof SiteSettingsFormValues, string>> {
  if (!fields) return {};
  const mapped: Partial<Record<keyof SiteSettingsFormValues, string>> = {};

  for (const [rawKey, messages] of Object.entries(fields)) {
    const message = messages?.[0];
    if (!message) continue;
    const leaf = rawKey.includes(".")
      ? rawKey.slice(rawKey.lastIndexOf(".") + 1)
      : rawKey;
    // Normalize PascalCase leaf → camelCase when needed
    const camel =
      leaf.charAt(0).toLowerCase() + leaf.slice(1);
    if (SETTINGS_FIELD_KEYS.has(camel as keyof SiteSettingsFormValues)) {
      mapped[camel as keyof SiteSettingsFormValues] = message;
    }
  }

  return mapped;
}
