import { describe, expect, it } from "vitest";

import {
  defaultsFromSettings,
  mapSettingsFieldErrors,
  normalizeSiteSettings,
  toSettingsPayload,
} from "./form-utils";
import type { SiteSettings } from "./types";

const base: SiteSettings = {
  store: {
    name: "رومرا",
    tagline: "تگ",
    logoUrl: "",
    description: "درباره",
  },
  contact: {
    supportEmail: "a@b.com",
    supportPhone: "02191000000",
    address: "تهران",
    workingHours: "۹–۱۸",
  },
  social: {
    instagram: "",
    telegram: "",
    whatsapp: "",
    twitter: "",
    youtube: "",
    linkedin: "",
  },
  shipping: { freeThreshold: 500_000, note: "" },
  seo: {
    defaultTitle: "",
    defaultDescription: "",
    ogImage: "",
    keywords: "",
  },
  maintenance: { enabled: false, message: "" },
  updatedAt: "2026-08-08T00:00:00Z",
};

describe("toSettingsPayload", () => {
  it("sends contact phone and address from flat form values", () => {
    const values = defaultsFromSettings(base);
    values.supportPhone = "09120000000";
    values.address = "آدرس جدید";
    const payload = toSettingsPayload(values);
    expect(payload.contact?.supportPhone).toBe("09120000000");
    expect(payload.contact?.address).toBe("آدرس جدید");
    expect(payload.store?.name).toBe("رومرا");
    expect(payload.shipping?.freeThreshold).toBe(500_000);
  });
});

describe("mapSettingsFieldErrors", () => {
  it("maps nested and PascalCase backend keys onto flat form fields", () => {
    expect(
      mapSettingsFieldErrors({
        "contact.supportPhone": ["شماره نامعتبر"],
        "Contact.Address": ["نشانی الزامی است"],
        freeThreshold: ["عدد نامعتبر"],
      }),
    ).toEqual({
      supportPhone: "شماره نامعتبر",
      address: "نشانی الزامی است",
      freeThreshold: "عدد نامعتبر",
    });
  });
});

describe("normalizeSiteSettings", () => {
  it("fills missing groups so form reset never throws", () => {
    const n = normalizeSiteSettings({ store: { name: "X" } } as SiteSettings);
    expect(n.store.name).toBe("X");
    expect(n.contact.supportPhone).toBe("");
    expect(n.shipping.freeThreshold).toBe(0);
  });
});
