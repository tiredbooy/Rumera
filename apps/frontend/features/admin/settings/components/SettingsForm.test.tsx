// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SiteSettings } from "@/features/settings/types";
import { SettingsForm } from "./SettingsForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeAll(() => {
  // Radix tabs measure content when forceMount keeps panels mounted.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

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

afterEach(cleanup);

describe("SettingsForm responsive tabs", () => {
  it("uses the full-width scrollable tab contract without shrinking labels", () => {
    render(<SettingsForm settings={settings} />);

    const tablist = screen.getByRole("tablist", {
      name: "بخش‌های تنظیمات",
    });
    const tabs = screen.getAllByRole("tab");

    expect(tablist).toHaveClass("w-full", "overflow-x-auto");
    expect(tabs).toHaveLength(7);
    tabs.forEach((tab) => expect(tab).toHaveClass("shrink-0", "px-3"));
  });
});
