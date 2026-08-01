import { faNum } from "@/lib/products";

const jalali = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });

/** ISO date to a Persian (Jalali) long date. */
export function formatJournalDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : jalali.format(date);
}

export function formatReadingTime(minutes: number): string {
  return `${faNum(minutes || 1)} دقیقه مطالعه`;
}
