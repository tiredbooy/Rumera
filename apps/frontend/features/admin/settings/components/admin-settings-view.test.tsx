import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/errors";
import type { SiteSettings } from "@/features/settings/types";

const mocks = vi.hoisted(() => ({
  getAdminSiteSettings: vi.fn(),
  refresh: vi.fn(),
  form: vi.fn(() => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/settings/api/server", () => ({
  getAdminSiteSettings: mocks.getAdminSiteSettings,
}));
vi.mock("./SettingsForm", () => ({
  SettingsForm: mocks.form,
}));

import { AdminSettingsView } from "./admin-settings-view";

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
    options: [],
  },
  updatedAt: "2026-07-18T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminSiteSettings.mockResolvedValue(settings);
});

describe("AdminSettingsView", () => {
  it("loads live settings and mounts the form", async () => {
    const element = await AdminSettingsView();
    const children = Array.isArray(element.props.children)
      ? element.props.children
      : [element.props.children];

    expect(mocks.getAdminSiteSettings).toHaveBeenCalledOnce();
    expect(children[1].type).toBe(mocks.form);
    expect(children[1].props).toEqual({ settings });
  });

  it("renders a Persian retry card when the settings fetch fails", async () => {
    mocks.getAdminSiteSettings.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(await AdminSettingsView());

    expect(mocks.form).not.toHaveBeenCalled();
    expect(markup).toContain("تنظیمات");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("بارگذاری تنظیمات ناموفق بود");
    expect(markup).toContain("هیچ مقدار جایگزینی نمایش داده نشده است");
    expect(markup).toContain("تلاش دوباره");
  });

  it("renders the retry state for a 500 from the settings API", async () => {
    mocks.getAdminSiteSettings.mockRejectedValue(
      new ApiError(500, "INTERNAL", "boom"),
    );

    const markup = renderToStaticMarkup(await AdminSettingsView());

    expect(mocks.form).not.toHaveBeenCalled();
    expect(markup).toContain("بارگذاری تنظیمات ناموفق بود");
  });

  it.each([401, 403] as const)(
    "rethrows %s so auth/forbidden stay outside the retry card",
    async (status) => {
      const error = new ApiError(status, "FORBIDDEN", "no access");
      mocks.getAdminSiteSettings.mockRejectedValue(error);

      await expect(AdminSettingsView()).rejects.toBe(error);
      expect(mocks.form).not.toHaveBeenCalled();
    },
  );
});
