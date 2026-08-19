import { formatMoney } from "@/lib/money";
import type { PaymentStatus } from "./types";

export const PAYMENT_STATUS_FA: Record<PaymentStatus, string> = {
  pending: "در انتظار",
  succeeded: "موفق",
  failed: "ناموفق",
  refunded: "بازپرداخت‌شده",
  partially_refunded: "بازپرداخت جزئی",
};

/**
 * Formats an exact decimal string without routing money through a JS float.
 * Shares lib/money.ts with the storefront's formatPrice — the two used to round
 * differently, so one gift card rendered as two different amounts (D-2).
 */
export const formatPaymentAmount = formatMoney;

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
