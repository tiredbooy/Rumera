import type { Address } from "@/features/addresses/types";
import type { Subscription } from "@/features/subscriptions/types";
import { faNum } from "@/lib/products";

const planFa: Record<string, string> = { "cellar-box": "باکس سرداب" };

const faDateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
});

export const cadenceShort: Record<Subscription["cadence"], string> = {
  monthly: "دورهٔ ماهانه",
  quarterly: "دورهٔ فصلی",
};

export function planName(plan: string): string {
  return planFa[plan] ?? "باکس دوره‌ای";
}

export function faDate(iso: string): string {
  try {
    return faDateFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Human cadence, e.g. «هر ۳۰ روز» / «هر ۳ ماه» — built with Persian digits. */
export function cadenceLabel(cadence: Subscription["cadence"]): string {
  return cadence === "quarterly" ? `هر ${faNum(3)} ماه` : `هر ${faNum(30)} روز`;
}

export function formatAddress(address: Address): string {
  const parts = [
    address.state_province,
    address.city,
    address.address_line1,
  ].filter(Boolean);
  return parts.join("، ");
}
