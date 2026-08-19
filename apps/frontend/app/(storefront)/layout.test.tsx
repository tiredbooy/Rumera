import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CategoryTree } from "@/features/catalog/categories/types";
import type { PublicSiteSettings } from "@/features/settings/types";

const mocks = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
  getPublicSiteSettingsOrNull: vi.fn(),
}));

vi.mock("@/features/catalog/categories/api", () => ({
  getCategoryTree: mocks.getCategoryTree,
}));

vi.mock("@/features/settings/api/server", () => ({
  getPublicSiteSettingsOrNull: mocks.getPublicSiteSettingsOrNull,
}));

vi.mock("@/features/storefront/navigation/components/site-header", () => ({
  SiteHeader: ({ categoryTree }: { categoryTree: CategoryTree[] }) => (
    <header data-category-count={String(categoryTree.length)} />
  ),
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer>footer</footer>,
}));

vi.mock("@/features/compliance/components/age-gate", () => ({
  AgeGate: () => null,
}));

vi.mock("@/features/referral/components/referral-tracker", () => ({
  ReferralTracker: () => null,
}));

vi.mock("@/features/cart/pending-intent", () => ({
  PendingCartIntent: () => null,
}));
vi.mock("@/features/recipes/pending-bulk-add", () => ({
  PendingBulkAddIntent: () => null,
}));
vi.mock("@/features/wishlist/pending-wishlist", () => ({
  PendingWishlistIntent: () => null,
}));
vi.mock("@/features/product-alerts/pending-alert", () => ({
  PendingAlertIntent: () => null,
}));

vi.mock(
  "@/features/storefront/maintenance/components/maintenance-screen",
  () => ({
    MaintenanceScreen: ({ message }: { message: string }) => (
      <main data-maintenance="true">{message}</main>
    ),
  }),
);

import StorefrontLayout from "./layout";

function settings(
  maintenance: PublicSiteSettings["maintenance"],
): PublicSiteSettings {
  return {
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
    maintenance,
    gift: {
      enabled: false,
      messageEnabled: false,
      messageMaxLength: 500,
      hidePriceEnabled: false,
      options: [],
    },
  };
}

describe("StorefrontLayout", () => {
  beforeEach(() => {
    mocks.getCategoryTree.mockReset();
    mocks.getPublicSiteSettingsOrNull.mockReset();
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(null);
  });

  it("renders children when getCategoryTree rejects", async () => {
    mocks.getCategoryTree.mockRejectedValue(new Error("tree unavailable"));

    const markup = renderToStaticMarkup(
      await StorefrontLayout({
        children: <p>page body</p>,
      }),
    );

    expect(markup).toContain("page body");
    expect(markup).toContain('data-category-count="0"');
    expect(markup).toContain("footer");
    expect(markup).not.toContain('data-maintenance="true"');
  });

  it("replaces shopping chrome with the settings message when maintenance is on", async () => {
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(
      settings({ enabled: true, message: "ظهر برمی‌گردیم." }),
    );
    mocks.getCategoryTree.mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await StorefrontLayout({
        children: <p>page body</p>,
      }),
    );

    expect(markup).toContain("ظهر برمی‌گردیم.");
    expect(markup).toContain('data-maintenance="true"');
    expect(markup).not.toContain("page body");
    expect(markup).not.toContain("<header");
    expect(markup).not.toContain("footer");
    expect(mocks.getCategoryTree).not.toHaveBeenCalled();
  });

  it("uses در حال تعمیر when maintenance is on without a published message", async () => {
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(
      settings({ enabled: true, message: "  " }),
    );

    const markup = renderToStaticMarkup(
      await StorefrontLayout({
        children: <p>page body</p>,
      }),
    );

    expect(markup).toContain("در حال تعمیر");
    expect(markup).not.toContain("page body");
  });

  it("keeps the shop open when settings are unavailable", async () => {
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(null);
    mocks.getCategoryTree.mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await StorefrontLayout({
        children: <p>page body</p>,
      }),
    );

    expect(markup).toContain("page body");
    expect(markup).toContain("<header");
    expect(markup).not.toContain('data-maintenance="true"');
  });
});
