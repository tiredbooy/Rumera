/**
 * Lightweight Jalali (Persian) calendar helpers without extra dependencies.
 * Used for admin date inputs that still submit Gregorian ISO to the API.
 */

import { toAsciiDigits } from "@/lib/normalize-digits";

const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const jDaysInMonth = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

export type JalaliParts = { jy: number; jm: number; jd: number };

export function toJalali(gy: number, gm: number, gd: number): JalaliParts {
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd;
  for (let i = 0; i < gm - 1; i += 1) days += gDaysInMonth[i]!;
  if (gm > 2 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) {
    days += 1;
  }
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    return { jy, jm, jd: 1 + (days % 31) };
  }
  days -= 186;
  jm = 7 + Math.floor(days / 30);
  return { jy, jm, jd: 1 + (days % 30) };
}

export function toGregorian(jy: number, jm: number, jd: number): {
  gy: number;
  gm: number;
  gd: number;
} {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]!; gm += 1) gd -= sal_a[gm]!;
  return { gy, gm, gd };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse `datetime-local` (YYYY-MM-DDTHH:mm[:ss]) → display Jalali `YYYY/MM/DD HH:mm`. */
export function gregorianLocalToJalaliDisplay(value: string): string {
  if (!value?.trim()) return "";
  const match = value
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
    );
  if (!match) return "";
  const gy = Number(match[1]);
  const gm = Number(match[2]);
  const gd = Number(match[3]);
  const hasTime = Boolean(match[4]);
  const hh = match[4] ?? "00";
  const mm = match[5] ?? "00";
  const { jy, jm, jd } = toJalali(gy, gm, gd);
  const date = `${jy}/${pad(jm)}/${pad(jd)}`;
  return hasTime ? `${date} ${hh}:${mm}` : date;
}

/**
 * Parse Jalali display `YYYY/MM/DD` or `YYYY/MM/DD HH:mm` → `datetime-local` value.
 * Returns null when the input is empty or invalid.
 */
export function jalaliDisplayToGregorianLocal(value: string): string | null {
  const trimmed = toAsciiDigits(value).trim();
  if (!trimmed) return "";
  const match = trimmed.match(
    /^(\d{3,4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const maxDay = jDaysInMonth[jm - 1] ?? 29;
  if (jd > maxDay && !(jm === 12 && jd === 30)) return null;
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  const hh = pad(Number(match[4] ?? 0));
  const mm = pad(Number(match[5] ?? 0));
  return `${gy}-${pad(gm)}-${pad(gd)}T${hh}:${mm}`;
}
