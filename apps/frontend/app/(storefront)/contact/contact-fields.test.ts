import { describe, expect, it } from "vitest";

import {
  presentContactFields,
  toTelHref,
} from "./contact-fields";

describe("toTelHref", () => {
  it("builds a tel link from ASCII, Persian, and spaced numbers", () => {
    expect(toTelHref("021 9100 0000")).toBe("tel:02191000000");
    expect(toTelHref("۰۲۱۹۱۰۰۰۰۰۰")).toBe("tel:02191000000");
    expect(toTelHref("+98 (21) 9100-0000")).toBe("tel:+982191000000");
  });

  it("does not invent a tel link from hours or empty copy", () => {
    expect(toTelHref("شنبه تا پنجشنبه، ۹ تا ۱۸")).toBeUndefined();
    expect(toTelHref("  ")).toBeUndefined();
  });
});

describe("presentContactFields", () => {
  it("keeps only non-empty published contact fields", () => {
    expect(
      presentContactFields({
        supportEmail: "  support@rumera.example  ",
        supportPhone: "",
        address: "تهران",
        workingHours: "   ",
      }),
    ).toEqual([
      {
        key: "supportEmail",
        label: "ایمیل پشتیبانی",
        value: "support@rumera.example",
        href: "mailto:support@rumera.example",
      },
      {
        key: "address",
        label: "نشانی",
        value: "تهران",
      },
    ]);
  });

  it("returns an empty list when contact is missing", () => {
    expect(presentContactFields(undefined)).toEqual([]);
    expect(presentContactFields(null)).toEqual([]);
    expect(presentContactFields({})).toEqual([]);
  });
});
