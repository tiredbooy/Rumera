import { faNum } from "@/lib/products";

import type { RecipeDifficulty } from "./types";

export const difficultyFa: Record<RecipeDifficulty, string> = {
  easy: "آسان",
  medium: "متوسط",
  hard: "پیشرفته",
};

const productRoleFa: Record<string, string> = {
  base: "پایهٔ اصلی",
  base_spirit: "پایهٔ اصلی",
  mixer: "ترکیب‌کننده",
  garnish: "تزئین",
  pairing: "پیشنهاد همراه",
  recommended: "پیشنهاد همراه",
};

export function formatRecipeProductRole(
  role: string | undefined,
): string | undefined {
  const normalized = role?.trim();
  if (!normalized) return undefined;
  return (
    productRoleFa[normalized.toLowerCase()] ??
    (/\p{Script=Arabic}/u.test(normalized) ? normalized : undefined)
  );
}

/** Minutes to a localized Persian duration. */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) {
    return `${faNum(hours)} ساعت و ${faNum(remainingMinutes)} دقیقه`;
  }
  if (hours > 0) return `${faNum(hours)} ساعت`;
  return `${faNum(remainingMinutes)} دقیقه`;
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Preserve the backend decimal string exactly while localizing its digits. */
export function formatRecipeQuantity(value: string): string {
  const normalized = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return normalized;
  const [integer, rawFraction] = normalized.split(".");
  const fraction = rawFraction?.replace(/0+$/, "");
  const localize = (part: string) =>
    part.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
  return `${localize(integer)}${fraction ? `٫${localize(fraction)}` : ""}`;
}
