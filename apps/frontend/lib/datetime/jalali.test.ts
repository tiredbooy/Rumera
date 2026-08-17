import { describe, expect, it } from "vitest";

import {
  gregorianLocalToJalaliDisplay,
  jalaliDisplayToGregorianLocal,
  toGregorian,
  toJalali,
} from "./jalali";

describe("jalali conversion", () => {
  it("round-trips a known civil date", () => {
    const j = toJalali(2026, 8, 8);
    const g = toGregorian(j.jy, j.jm, j.jd);
    expect(g).toEqual({ gy: 2026, gm: 8, gd: 8 });
  });

  it("converts datetime-local strings to Jalali display", () => {
    const display = gregorianLocalToJalaliDisplay("2026-08-08T14:30");
    expect(display).toMatch(/^\d{4}\/\d{2}\/\d{2} 14:30$/);
  });

  it("omits the time from a date-only Gregorian value", () => {
    const display = gregorianLocalToJalaliDisplay("2026-08-08");
    expect(display).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  it("parses Jalali display back to datetime-local", () => {
    const j = toJalali(2026, 3, 21);
    const display = `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")} 09:15`;
    const local = jalaliDisplayToGregorianLocal(display);
    expect(local).toBe("2026-03-21T09:15");
  });

  it("returns empty string for blank input and null for garbage", () => {
    expect(jalaliDisplayToGregorianLocal("")).toBe("");
    expect(jalaliDisplayToGregorianLocal("not-a-date")).toBeNull();
  });

  it("accepts Persian digits in a Jalali display string", () => {
    const j = toJalali(2026, 3, 21);
    const display = `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")} 09:15`;
    const persian = display.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]!);
    expect(jalaliDisplayToGregorianLocal(persian)).toBe("2026-03-21T09:15");
  });
});
