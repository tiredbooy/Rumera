import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSiteSettings } from "@/features/settings/types";
import { brandCopy } from "@/lib/brand";

const mocks = vi.hoisted(() => ({
  getPublicSiteSettingsOrNull: vi.fn(),
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

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
  }: {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  ),
}));

vi.mock("@/features/settings/api/server", () => ({
  getPublicSiteSettingsOrNull: mocks.getPublicSiteSettingsOrNull,
}));

import { SiteFooter } from "./site-footer";

function settings(
  overrides: Partial<PublicSiteSettings> = {},
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
    maintenance: { enabled: false, message: "" },
    gift: {
      enabled: false,
      messageEnabled: false,
      messageMaxLength: 500,
      hidePriceEnabled: false,
      options: [],
    },
    ...overrides,
  };
}

describe("SiteFooter storefront discovery", () => {
  beforeEach(() => {
    mocks.getPublicSiteSettingsOrNull.mockReset();
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(null);
  });

  it("links to the public tag directory exactly once", async () => {
    const markup = renderToStaticMarkup(await SiteFooter());

    expect(markup.match(/href="\/tags"/g)).toHaveLength(1);
    expect(markup).toContain(">برچسب‌ها</a>");
  });

  it("uses the live store name and published socials, omitting empty and #", async () => {
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(
      settings({
        store: {
          name: "سردابه",
          tagline: "",
          logoUrl: "",
          description: "",
        },
        social: {
          instagram: "https://instagram.com/sardabeh",
          telegram: "#",
          whatsapp: "",
          twitter: "  ",
          youtube: "",
          linkedin: "",
        },
      }),
    );

    const markup = renderToStaticMarkup(await SiteFooter());

    expect(markup).toContain("© ۱۴۰۴ سردابه");
    expect(markup).toContain('aria-label="سردابه — خانه"');
    expect(markup).toContain('href="https://instagram.com/sardabeh"');
    expect(markup).toContain('aria-label="اینستاگرام"');
    expect(markup).not.toContain('href="#"');
    expect(markup).not.toContain("تردز");
    expect(markup).not.toContain("خوراک خبری");
  });

  it("does not offer a live newsletter signup", async () => {
    const markup = renderToStaticMarkup(await SiteFooter());

    expect(markup).not.toContain('type="email"');
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("ایمیل برای دسترسی زودهنگام");
    expect(markup).toContain("خبرنامه به‌زودی");
    expect(markup).toContain("فعلاً ایمیلی دریافت نمی‌شود");
  });

  it("does not invent contact claims when settings omit them", async () => {
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(settings());

    const markup = renderToStaticMarkup(await SiteFooter());

    expect(markup).toContain(`© ۱۴۰۴ ${brandCopy.wordmarkFa}`);
    expect(markup).not.toContain("hello@rumera.example");
    expect(markup).not.toContain("+۹۸ ۲۱ ۰۰۰۰ ۰۰۰۰");
    expect(markup).not.toContain("۹ تا ۲۱");
    expect(markup).not.toContain("واتساپ");
    expect(markup).not.toContain('href="#"');
  });

  it("renders only published contact fields", async () => {
    mocks.getPublicSiteSettingsOrNull.mockResolvedValue(
      settings({
        contact: {
          supportEmail: "support@rumera.example",
          supportPhone: "02191000000",
          address: "تهران — not shown in chrome",
          workingHours: "",
        },
      }),
    );

    const markup = renderToStaticMarkup(await SiteFooter());

    expect(markup).toContain("support@rumera.example");
    expect(markup).toContain('href="mailto:support@rumera.example"');
    expect(markup).toContain("02191000000");
    expect(markup).toContain('href="tel:02191000000"');
    expect(markup).not.toContain("تهران — not shown in chrome");
    expect(markup).not.toContain("۹ تا ۲۱");
  });
});
