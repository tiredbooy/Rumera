import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSiteSettings } from "@/features/settings/types";

const mocks = vi.hoisted(() => ({
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/settings/api/server", () => ({
  getPublicSiteSettings: mocks.getPublicSiteSettings,
}));

import ContactPage from "./page";

function settings(
  contact: Partial<PublicSiteSettings["contact"]> = {},
): PublicSiteSettings {
  return {
    store: { name: "رومرا", tagline: "", logoUrl: "", description: "" },
    contact: {
      supportEmail: "",
      supportPhone: "",
      address: "",
      workingHours: "",
      ...contact,
    },
    social: {
      instagram: "",
      telegram: "",
      whatsapp: "989121234567",
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
      enabled: false,
      messageEnabled: false,
      messageMaxLength: 500,
      hidePriceEnabled: false,
      options: [],
    },
  };
}

describe("ContactPage", () => {
  beforeEach(() => {
    mocks.getPublicSiteSettings.mockReset();
  });

  it("renders published email, phone, address, and hours from settings", async () => {
    mocks.getPublicSiteSettings.mockResolvedValue(
      settings({
        supportEmail: "support@rumera.example",
        supportPhone: "02191000000",
        address: "تهران، خیابان مثال",
        workingHours: "شنبه تا پنجشنبه، ۹ تا ۱۸",
      }),
    );

    const markup = renderToStaticMarkup(await ContactPage());

    expect(mocks.getPublicSiteSettings).toHaveBeenCalledOnce();
    expect(markup).toContain('aria-label="راه‌های تماس"');
    expect(markup).toContain("ایمیل پشتیبانی");
    expect(markup).toContain("support@rumera.example");
    expect(markup).toContain('href="mailto:support@rumera.example"');
    expect(markup).toContain("تلفن پشتیبانی");
    expect(markup).toContain("02191000000");
    expect(markup).toContain('href="tel:02191000000"');
    expect(markup).toContain("تهران، خیابان مثال");
    expect(markup).toContain("شنبه تا پنجشنبه، ۹ تا ۱۸");
    expect(markup).not.toContain("واتساپ");
    expect(markup).not.toContain("whatsapp");
    expect(markup).not.toContain("989121234567");
  });

  it("omits missing contact fields and does not invent WhatsApp or hours", async () => {
    mocks.getPublicSiteSettings.mockResolvedValue(
      settings({
        supportEmail: "hello@rumera.example",
      }),
    );

    const markup = renderToStaticMarkup(await ContactPage());

    expect(markup).toContain("hello@rumera.example");
    expect(markup).not.toContain("تلفن پشتیبانی");
    expect(markup).not.toContain("نشانی");
    expect(markup).not.toContain("ساعات کاری");
    expect(markup).not.toContain("واتساپ");
    expect(markup).not.toContain("۹ تا ۲۱");
  });

  it("renders a truthful empty state when no contact fields are published", async () => {
    mocks.getPublicSiteSettings.mockResolvedValue(settings());

    const markup = renderToStaticMarkup(await ContactPage());

    expect(markup).toContain("هنوز اطلاعات تماسی منتشر نشده است");
    expect(markup).toContain("اطلاعات تماسی ثبت نشده");
    expect(markup).not.toContain('aria-label="راه‌های تماس"');
    expect(markup).not.toContain("واتساپ");
    expect(markup).not.toContain("۹ تا ۲۱");
  });

  it("renders a truthful load-error state distinct from empty settings", async () => {
    mocks.getPublicSiteSettings.mockRejectedValue(new Error("offline"));

    const markup = renderToStaticMarkup(await ContactPage());

    expect(markup).toContain("بارگذاری اطلاعات تماس ناموفق بود");
    expect(markup).toContain("فعلاً اطلاعات تماس در دسترس نیست");
    expect(markup).toContain('href="/faq"');
    expect(markup).not.toContain("اطلاعات تماسی ثبت نشده");
    expect(markup).not.toContain('aria-label="راه‌های تماس"');
  });
});
