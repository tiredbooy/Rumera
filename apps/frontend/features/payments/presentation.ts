import type { PaymentStatus } from "./types";

export const PAYMENT_STATUS_FA: Record<PaymentStatus, string> = {
  pending: "در انتظار",
  succeeded: "موفق",
  failed: "ناموفق",
  refunded: "بازپرداخت‌شده",
  partially_refunded: "بازپرداخت جزئی",
};

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function localizeDigits(value: string): string {
  return value.replace(
    /\d/g,
    (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit,
  );
}

/** Formats an exact decimal string without routing money through a JS float. */
export function formatPaymentAmount(amount: string, currency: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) return `${amount} ${currency}`.trim();

  const [, sign, integer, fraction] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  const decimal = fraction ? `٫${fraction}` : "";
  const localized = localizeDigits(`${sign}${grouped}${decimal}`);
  return currency.toUpperCase() === "IRT"
    ? `${localized} تومان`
    : `${localized} ${currency.toUpperCase()}`;
}

export function decodePaymentRawResponse(rawResponse?: string): string | null {
  if (!rawResponse) return null;
  try {
    const bytes = Uint8Array.from(atob(rawResponse), (char) =>
      char.charCodeAt(0),
    );
    const decoded = new TextDecoder().decode(bytes);
    try {
      return JSON.stringify(JSON.parse(decoded), null, 2);
    } catch {
      return decoded;
    }
  } catch {
    return null;
  }
}
