import type { ContactSettings } from "@/features/settings/types";

export type ContactFieldKey =
  | "supportEmail"
  | "supportPhone"
  | "address"
  | "workingHours";

export type PresentContactField = {
  key: ContactFieldKey;
  label: string;
  value: string;
  href?: string;
};

export const CONTACT_FIELD_LABELS: Record<ContactFieldKey, string> = {
  supportEmail: "ایمیل پشتیبانی",
  supportPhone: "تلفن پشتیبانی",
  address: "نشانی",
  workingHours: "ساعات کاری",
};

const FIELD_ORDER: ContactFieldKey[] = [
  "supportEmail",
  "supportPhone",
  "address",
  "workingHours",
];

function presentText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** `tel:` only when the published value is a real phone, not invented hours. */
export function toTelHref(phone: string): string | undefined {
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

/** Live `contact.*` only. Empty / whitespace / non-strings are omitted. */
export function presentContactFields(
  contact: Partial<ContactSettings> | null | undefined,
): PresentContactField[] {
  if (!contact) return [];

  const fields: PresentContactField[] = [];
  for (const key of FIELD_ORDER) {
    const value = presentText(contact[key]);
    if (!value) continue;

    const href =
      key === "supportEmail"
        ? `mailto:${value}`
        : key === "supportPhone"
          ? toTelHref(value)
          : undefined;

    fields.push({
      key,
      label: CONTACT_FIELD_LABELS[key],
      value,
      ...(href ? { href } : {}),
    });
  }
  return fields;
}
