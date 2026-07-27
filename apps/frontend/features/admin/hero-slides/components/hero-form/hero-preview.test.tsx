// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/smart-image", () => ({
  SmartImage: ({ src, alt }: { src?: string | null; alt: string }) => (
    <div role="img" aria-label={alt} data-src={src ?? ""} />
  ),
}));

import { HeroPreviewPanel, type HeroPreviewValues } from "./hero-preview";

afterEach(cleanup);

const preview: HeroPreviewValues = {
  desktopImageUrl: "/media/hero-desktop.webp",
  mobileImageUrl: "/media/hero-mobile.webp",
  imageAlt: "بطری‌های رومرا",
  title: "مجموعهٔ تابستان",
  eyebrow: "انتخاب سردبیر",
  subtitle: "محصولات تازه برای روزهای گرم",
  badge: "جدید",
  ctaLabel: "مشاهده محصولات",
  ctaHref: "",
  secondaryCtaLabel: "دسته‌بندی‌ها",
  secondaryCtaHref: "/categories",
  theme: "light",
  isActive: true,
  startsAt: "2099-01-01T00:00:00",
  endsAt: "",
};

function renderPreview(values: HeroPreviewValues = preview) {
  return render(
    <HeroPreviewPanel
      preview={values}
      submitLabel="ذخیره"
      isSubmitting={false}
      uploadBusy={false}
      onCancel={vi.fn()}
    />,
  );
}

describe("HeroPreviewPanel", () => {
  it("switches media by device and mirrors storefront CTA rules", () => {
    renderPreview();

    expect(screen.getByRole("img", { name: "بطری‌های رومرا" })).toHaveAttribute(
      "data-src",
      "/media/hero-desktop.webp",
    );
    expect(screen.queryByText("مشاهده محصولات")).not.toBeInTheDocument();
    expect(screen.getByText("دسته‌بندی‌ها")).toBeInTheDocument();
    expect(screen.getByText("زمان‌بندی‌شده")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "نمای موبایل" }));

    expect(screen.getByRole("img", { name: "بطری‌های رومرا" })).toHaveAttribute(
      "data-src",
      "/media/hero-mobile.webp",
    );
    expect(screen.getByTestId("hero-preview-frame")).toHaveAttribute(
      "data-device",
      "mobile",
    );
    expect(screen.getByTestId("hero-preview-frame")).toHaveAttribute(
      "data-theme",
      "light",
    );
  });

  it("falls back to desktop media in the mobile frame", () => {
    renderPreview({ ...preview, mobileImageUrl: "", theme: "dark" });

    fireEvent.click(screen.getByRole("radio", { name: "نمای موبایل" }));

    expect(screen.getByRole("img", { name: "بطری‌های رومرا" })).toHaveAttribute(
      "data-src",
      "/media/hero-desktop.webp",
    );
    expect(
      screen.getByText(
        "تصویر موبایل ثبت نشده؛ تصویر دسکتاپ نمایش داده می‌شود.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("hero-preview-frame")).toHaveAttribute(
      "data-theme",
      "dark",
    );
  });
});
