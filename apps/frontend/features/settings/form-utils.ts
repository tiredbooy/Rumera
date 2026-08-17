import type { ApiFieldErrors } from "@/lib/api/types";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";

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
  "giftEnabled",
  "giftMessageEnabled",
  "giftHidePriceEnabled",
  "giftOptions",
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
  gift: {
    enabled: true,
    messageEnabled: true,
    messageMaxLength: 500,
    hidePriceEnabled: true,
    options: [
      {
        id: "gift_wrap",
        label: "بسته‌بندی هدیه",
        description: "بسته‌بندی شیک مناسب هدیه",
        price: 0,
        enabled: true,
        sortOrder: 0,
      },
    ],
  },
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
    gift: normalizeGift(settings.gift),
    updatedAt: settings.updatedAt ?? "",
  };
}

function normalizeGift(
  gift: Partial<SiteSettings["gift"]> | null | undefined,
): SiteSettings["gift"] {
  const base = EMPTY_SETTINGS.gift;
  if (!gift || typeof gift !== "object") return { ...base, options: [...base.options] };
  const options = Array.isArray(gift.options)
    ? gift.options.map((o, i) => ({
        id: String(o?.id ?? "").trim() || `option_${i + 1}`,
        label: String(o?.label ?? "").trim() || "گزینه",
        description: String(o?.description ?? ""),
        price:
          typeof o?.price === "number" && Number.isFinite(o.price) && o.price >= 0
            ? o.price
            : 0,
        enabled: o?.enabled !== false,
        sortOrder:
          typeof o?.sortOrder === "number" && Number.isFinite(o.sortOrder)
            ? o.sortOrder
            : i,
      }))
    : [...base.options];
  return {
    enabled: gift.enabled !== false,
    messageEnabled: gift.messageEnabled !== false,
    messageMaxLength:
      typeof gift.messageMaxLength === "number" && gift.messageMaxLength > 0
        ? Math.min(500, gift.messageMaxLength)
        : 500,
    hidePriceEnabled: gift.hidePriceEnabled !== false,
    options,
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
    giftEnabled: n.gift.enabled,
    giftMessageEnabled: n.gift.messageEnabled,
    giftHidePriceEnabled: n.gift.hidePriceEnabled,
    giftOptions: (n.gift.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      description: o.description ?? "",
      price:
        typeof o.price === "number" && Number.isFinite(o.price) && o.price > 0
          ? String(Math.trunc(o.price))
          : o.price === 0
            ? "0"
            : "",
      enabled: o.enabled !== false,
    })),
  };
}

/** Flat form values → full wholesale-replace payload (every group). */
export function toSettingsPayload(
  v: SiteSettingsFormValues,
): UpdateSiteSettingsInput {
  const thresholdRaw = toAsciiDigits(v.freeThreshold).trim();
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
      supportPhone: toAsciiDigits(v.supportPhone).trim(),
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
    gift: parseGiftPayload(v),
  };
}

function parseGiftPayload(v: SiteSettingsFormValues): SiteSettings["gift"] {
  const seen = new Set<string>();
  const options: SiteSettings["gift"]["options"] = [];
  for (let i = 0; i < (v.giftOptions ?? []).length; i++) {
    const row = v.giftOptions[i];
    const id = row.id.trim().toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const priceRaw = toAsciiDigits(row.price).trim();
    const price =
      priceRaw === "" || !/^\d+$/.test(priceRaw)
        ? 0
        : Math.max(0, Math.trunc(parseAsciiNumber(priceRaw)));
    options.push({
      id,
      label: row.label.trim() || "گزینه",
      description: row.description ?? "",
      price,
      enabled: row.enabled !== false,
      sortOrder: i,
    });
  }
  return {
    enabled: v.giftEnabled,
    messageEnabled: v.giftMessageEnabled,
    messageMaxLength: 500,
    hidePriceEnabled: v.giftHidePriceEnabled,
    options,
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
