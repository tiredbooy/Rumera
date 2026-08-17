import { describe, expect, it } from "vitest";

import { brandCopy } from "@/lib/brand";
import { formatPrice } from "@/lib/products";

import {
  presentChromeContact,
  presentSocialLinks,
  presentStorefrontAnnouncement,
  presentStoreName,
  socialHref,
  toStorefrontChromeSettings,
} from "./chrome-settings";

const emptySocial = {
  instagram: "",
  telegram: "",
  whatsapp: "",
  twitter: "",
  youtube: "",
  linkedin: "",
};

describe("presentStoreName", () => {
  it("uses the published store name and falls back to the brand wordmark", () => {
    expect(presentStoreName({ name: "سردابه" })).toBe("سردابه");
    expect(presentStoreName({ name: "  " })).toBe(brandCopy.wordmarkFa);
    expect(presentStoreName(null)).toBe(brandCopy.wordmarkFa);
  });
});

describe("presentSocialLinks", () => {
  it("omits empty, whitespace, and hash placeholders", () => {
    expect(
      presentSocialLinks({
        ...emptySocial,
        instagram: "#",
        telegram: "   ",
        whatsapp: "",
      }),
    ).toEqual([]);
  });

  it("maps handles and http(s) URLs and skips other protocols", () => {
    expect(
      presentSocialLinks({
        ...emptySocial,
        instagram: "rumera",
        telegram: "https://t.me/rumera",
        twitter: "javascript:alert(1)",
      }),
    ).toEqual([
      {
        key: "instagram",
        label: "اینستاگرام",
        href: "https://instagram.com/rumera",
      },
      {
        key: "telegram",
        label: "تلگرام",
        href: "https://t.me/rumera",
      },
    ]);
  });

  it("builds a wa.me link from a published phone handle", () => {
    expect(socialHref("989121234567", "whatsapp", "https://wa.me/")).toBe(
      "https://wa.me/989121234567",
    );
  });
});

describe("presentStorefrontAnnouncement", () => {
  it("formats a live free-ship threshold and does not invent ۵٬۰۰۰٬۰۰۰", () => {
    expect(
      presentStorefrontAnnouncement({ freeThreshold: 6_000_000, note: "" }),
    ).toBe(
      `ارسال رایگان برای سفارش‌های بالای ${formatPrice(6_000_000)} — با ضمانت اصالت`,
    );
    expect(
      presentStorefrontAnnouncement({ freeThreshold: 0, note: "" }),
    ).toBeUndefined();
    expect(
      presentStorefrontAnnouncement({ freeThreshold: 6_000_000, note: "" }),
    ).not.toContain("۵٬۰۰۰٬۰۰۰");
  });

  it("uses the published shipping note only when no positive threshold exists", () => {
    expect(
      presentStorefrontAnnouncement({
        freeThreshold: 0,
        note: "ارسال رایگان در تهران",
      }),
    ).toBe("ارسال رایگان در تهران");
  });
});

describe("presentChromeContact", () => {
  it("omits unpublished contact and does not invent hours or WhatsApp", () => {
    expect(presentChromeContact({})).toEqual({});
    expect(
      presentChromeContact({
        supportEmail: "hello@rumera.example",
        supportPhone: "  ",
        workingHours: "",
      }),
    ).toEqual({
      supportEmail: {
        value: "hello@rumera.example",
        href: "mailto:hello@rumera.example",
      },
    });
  });
});

describe("toStorefrontChromeSettings", () => {
  it("settles a missing document to brand name, no socials, no invented promo", () => {
    const chrome = toStorefrontChromeSettings(null);
    expect(chrome.storeName).toBe(brandCopy.wordmarkFa);
    expect(chrome.socials).toEqual([]);
    expect(chrome.announcement).toBeUndefined();
    expect(chrome.contact).toEqual({});
  });
});
