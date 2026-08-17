import type {
  ContactSettings,
  SiteShippingSettings,
  SocialSettings,
  StoreSettings,
} from "@/features/settings/types";
import { brandCopy } from "@/lib/brand";
import { formatPrice } from "@/lib/products";

export function presentText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** Visible store name. Empty settings fall back to the brand wordmark — not a contact claim. */
export function presentStoreName(
  store?: Partial<StoreSettings> | null,
): string {
  return presentText(store?.name) ?? brandCopy.wordmarkFa;
}

export type ChromeSocialKey =
  | "instagram"
  | "telegram"
  | "whatsapp"
  | "twitter"
  | "youtube"
  | "linkedin";

export type ChromeSocialLink = {
  key: ChromeSocialKey;
  label: string;
  href: string;
};

const SOCIAL_NETWORKS: {
  key: ChromeSocialKey;
  label: string;
  prefix: string;
}[] = [
  { key: "instagram", label: "اینستاگرام", prefix: "https://instagram.com/" },
  { key: "telegram", label: "تلگرام", prefix: "https://t.me/" },
  { key: "whatsapp", label: "واتساپ", prefix: "https://wa.me/" },
  { key: "twitter", label: "ایکس", prefix: "https://x.com/" },
  { key: "youtube", label: "یوتیوب", prefix: "https://youtube.com/" },
  { key: "linkedin", label: "لینکدین", prefix: "https://www.linkedin.com/" },
];

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Published social value → href. Empty, `#`, and non-http(s) protocols are omitted. */
export function socialHref(
  raw: string,
  key: ChromeSocialKey,
  prefix: string,
): string | undefined {
  const value = raw.trim();
  if (!value || value === "#") return undefined;

  if (value.startsWith("//")) {
    const candidate = `https:${value}`;
    return isHttpUrl(candidate) ? candidate : undefined;
  }

  if (isHttpUrl(value)) return value;

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return undefined;

  const handle = value.replace(/^@/, "").replace(/^\/+/, "");
  if (!handle) return undefined;

  if (key === "whatsapp") {
    const compact = handle
      .replace(/[\u06F0-\u06F9]/g, (digit) =>
        String(digit.charCodeAt(0) - 0x06f0),
      )
      .replace(/[\u0660-\u0669]/g, (digit) =>
        String(digit.charCodeAt(0) - 0x0660),
      )
      .replace(/[^\d+]/g, "");
    if (!/^\+?\d{8,20}$/.test(compact)) return undefined;
    return `https://wa.me/${compact.replace(/^\+/, "")}`;
  }

  if (key === "linkedin") {
    if (handle.includes("/")) {
      return `https://www.linkedin.com/${handle}`;
    }
    return `https://www.linkedin.com/in/${handle}`;
  }

  return `${prefix}${handle}`;
}

export function presentSocialLinks(
  social?: Partial<SocialSettings> | null,
): ChromeSocialLink[] {
  if (!social) return [];

  const links: ChromeSocialLink[] = [];
  for (const network of SOCIAL_NETWORKS) {
    const raw = social[network.key];
    if (typeof raw !== "string") continue;
    const href = socialHref(raw, network.key, network.prefix);
    if (!href) continue;
    links.push({ key: network.key, label: network.label, href });
  }
  return links;
}

/** Promo copy from settings only. Never invent a ۵٬۰۰۰٬۰۰۰ threshold. */
export function presentStorefrontAnnouncement(
  shipping?: Partial<SiteShippingSettings> | null,
): string | undefined {
  const threshold = shipping?.freeThreshold;
  const hasThreshold =
    typeof threshold === "number" &&
    Number.isFinite(threshold) &&
    threshold > 0;

  if (hasThreshold) {
    return `ارسال رایگان برای سفارش‌های بالای ${formatPrice(threshold)} — با ضمانت اصالت`;
  }

  return presentText(shipping?.note);
}

export type ChromeContact = {
  supportEmail?: { value: string; href: string };
  supportPhone?: { value: string; href?: string };
  workingHours?: string;
};

function toTelHref(phone: string): string | undefined {
  const ascii = phone
    .replace(/[\u06F0-\u06F9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    );
  const compact = ascii.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{3,20}$/.test(compact)) return undefined;
  return `tel:${compact}`;
}

/** Footer contact row — published email / phone / hours only. */
export function presentChromeContact(
  contact?: Partial<ContactSettings> | null,
): ChromeContact {
  const result: ChromeContact = {};
  const email = presentText(contact?.supportEmail);
  if (email) result.supportEmail = { value: email, href: `mailto:${email}` };

  const phone = presentText(contact?.supportPhone);
  if (phone) {
    const href = toTelHref(phone);
    result.supportPhone = href ? { value: phone, href } : { value: phone };
  }

  const hours = presentText(contact?.workingHours);
  if (hours) result.workingHours = hours;

  return result;
}

export type StorefrontChromeSettings = {
  storeName: string;
  tagline?: string;
  description?: string;
  announcement?: string;
  socials: ChromeSocialLink[];
  contact: ChromeContact;
};

export function toStorefrontChromeSettings(
  settings: {
    store?: Partial<StoreSettings> | null;
    social?: Partial<SocialSettings> | null;
    shipping?: Partial<SiteShippingSettings> | null;
    contact?: Partial<ContactSettings> | null;
  } | null,
): StorefrontChromeSettings {
  return {
    storeName: presentStoreName(settings?.store),
    tagline: presentText(settings?.store?.tagline),
    description: presentText(settings?.store?.description),
    announcement: presentStorefrontAnnouncement(settings?.shipping),
    socials: presentSocialLinks(settings?.social),
    contact: presentChromeContact(settings?.contact),
  };
}
