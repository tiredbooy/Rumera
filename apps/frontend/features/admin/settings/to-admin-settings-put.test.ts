import { describe, expect, it } from "vitest";

import { defaultsFromSettings } from "@/features/settings/form-utils";
import type { SiteSettings } from "@/features/settings/types";

import { toAdminSettingsPutBody } from "./to-admin-settings-put";

const settings: SiteSettings = {
  store: { name: "رومرا", tagline: "", logoUrl: "", description: "" },
  contact: {
    supportEmail: "",
    supportPhone: "",
    address: "",
    workingHours: "",
  },
  social: {
    instagram: "",
    telegram: "",
    whatsapp: "",
    twitter: "",
    youtube: "",
    linkedin: "",
  },
  shipping: { freeThreshold: 0, note: "" },
  seo: {
    defaultTitle: "",
    defaultDescription: "",
    ogImage: "",
    keywords: "",
  },
  maintenance: { enabled: false, message: "" },
  gift: {
    enabled: true,
    messageEnabled: true,
    messageMaxLength: 500,
    hidePriceEnabled: true,
    options: [
      {
        id: "gift_wrap",
        label: "بسته‌بندی هدیه",
        description: "",
        price: 0,
        enabled: true,
        sortOrder: 0,
      },
    ],
  },
  updatedAt: "2026-07-18T00:00:00Z",
};

describe("toAdminSettingsPutBody", () => {
  it("sends expected_updated_at from the last GET timestamp", () => {
    const values = defaultsFromSettings(settings);
    const payload = toAdminSettingsPutBody(values, settings.updatedAt);

    expect(payload.expected_updated_at).toBe("2026-07-18T00:00:00Z");
    expect(payload.store?.name).toBe("رومرا");
  });

  it("omits expected_updated_at when the last GET had no timestamp", () => {
    const values = defaultsFromSettings(settings);
    expect(toAdminSettingsPutBody(values, "")).not.toHaveProperty(
      "expected_updated_at",
    );
    expect(toAdminSettingsPutBody(values, "   ")).not.toHaveProperty(
      "expected_updated_at",
    );
    expect(toAdminSettingsPutBody(values, undefined)).not.toHaveProperty(
      "expected_updated_at",
    );
  });
});
