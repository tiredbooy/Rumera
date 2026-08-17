import { describe, expect, it } from "vitest";

import { parseAsciiNumber, toAsciiDigits } from "./normalize-digits";

describe("toAsciiDigits", () => {
  it("maps Persian and Arabic-Indic digits and leaves ASCII alone", () => {
    expect(toAsciiDigits("۱۲۳٤٥6")).toBe("123456");
    expect(toAsciiDigits("0912")).toBe("0912");
  });

  it("folds a unicode minus so signed inventory deltas parse", () => {
    expect(toAsciiDigits("−۳")).toBe("-3");
  });

  it("strips fa-IR grouping and maps the Arabic decimal mark", () => {
    expect(toAsciiDigits("−۱٬۲۵۰")).toBe("-1250");
    expect(toAsciiDigits("۱۲٫۵")).toBe("12.5");
  });

  it("parses a ledger-style signed amount", () => {
    expect(parseAsciiNumber("−۳۰")).toBe(-30);
    expect(parseAsciiNumber("٥٠٠")).toBe(500);
  });
});
