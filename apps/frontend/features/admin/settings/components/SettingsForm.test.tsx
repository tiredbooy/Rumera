// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SettingsApiError } from "@/features/settings/api/client";
import type { SiteSettings } from "@/features/settings/types";
import { SettingsForm } from "./SettingsForm";

const mocks = vi.hoisted(() => ({
  updateSiteSettings: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/features/settings/api/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/settings/api/client")
  >("@/features/settings/api/client");
  return {
    ...actual,
    updateSiteSettings: mocks.updateSiteSettings,
  };
});

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateSiteSettings.mockResolvedValue({
    ...settings,
    updatedAt: "2026-08-16T12:00:00Z",
  });
});

describe("SettingsForm", () => {
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

  it("sends expected_updated_at from the last GET on save", async () => {
    render(<SettingsForm settings={settings} />);

    fireEvent.change(screen.getByLabelText("نام فروشگاه"), {
      target: { value: "رومرا جدید" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تنظیمات" }));

    await waitFor(() =>
      expect(mocks.updateSiteSettings).toHaveBeenCalledTimes(1),
    );
    expect(mocks.updateSiteSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_updated_at: "2026-07-18T00:00:00Z",
        store: expect.objectContaining({ name: "رومرا جدید" }),
      }),
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("rebases expected_updated_at onto the PUT response for the next save", async () => {
    render(<SettingsForm settings={settings} />);

    const save = () => screen.getByRole("button", { name: "ذخیرهٔ تنظیمات" });

    fireEvent.change(screen.getByLabelText("نام فروشگاه"), {
      target: { value: "رومرا یک" },
    });
    fireEvent.click(save());
    await waitFor(() =>
      expect(mocks.updateSiteSettings).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(save()).toBeDisabled());

    fireEvent.change(screen.getByLabelText("نام فروشگاه"), {
      target: { value: "رومرا دو" },
    });
    await waitFor(() => expect(save()).toBeEnabled());
    fireEvent.click(save());
    await waitFor(() =>
      expect(mocks.updateSiteSettings).toHaveBeenCalledTimes(2),
    );

    expect(mocks.updateSiteSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expected_updated_at: "2026-08-16T12:00:00Z",
        store: expect.objectContaining({ name: "رومرا دو" }),
      }),
    );
  });

  it("marks the tab that owns a client-side save error", async () => {
    render(<SettingsForm settings={settings} />);

    fireEvent.change(screen.getByLabelText("نام فروشگاه"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تنظیمات" }));

    const storeTab = await screen.findByRole("tab", {
      name: "فروشگاه، دارای خطا",
    });
    expect(storeTab).toHaveAttribute("data-state", "active");
    expect(storeTab).toHaveAttribute("data-invalid", "true");
    expect(mocks.updateSiteSettings).not.toHaveBeenCalled();
  });

  it("focuses the SEO tab when the server rejects a field on that panel", async () => {
    mocks.updateSiteSettings.mockRejectedValue(
      new SettingsApiError(422, "VALIDATION", "seo invalid", {
        defaultTitle: ["عنوان سئو معتبر نیست"],
      }),
    );
    render(<SettingsForm settings={settings} />);

    fireEvent.change(screen.getByLabelText("نام فروشگاه"), {
      target: { value: "رومرا تازه" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تنظیمات" }));

    const seoTab = await screen.findByRole("tab", { name: "سئو، دارای خطا" });
    expect(seoTab).toHaveAttribute("data-state", "active");
    expect(screen.getByText("عنوان سئو معتبر نیست")).toBeInTheDocument();
  });
});
