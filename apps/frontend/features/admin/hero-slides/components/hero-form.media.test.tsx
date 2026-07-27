// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import type { AdminHeroSlide } from "@/features/hero-slides/types";

type ContentImageHandle = ImageUploaderHandle<UploadedImage | null>;

const {
  createHeroSlideMock,
  updateHeroSlideMock,
  desktopFlushMock,
  pushMock,
  refreshMock,
} = vi.hoisted(() => ({
  createHeroSlideMock: vi.fn(),
  updateHeroSlideMock: vi.fn(),
  desktopFlushMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/features/hero-slides/api/client", () => ({
  HeroSlideApiError: class HeroSlideApiError extends Error {},
  createHeroSlide: createHeroSlideMock,
  updateHeroSlide: updateHeroSlideMock,
}));

vi.mock("./hero-form/content-fields", () => ({
  HeroContentFields: ({
    register,
  }: {
    register: (name: "title") => object;
  }) => <input aria-label="عنوان" {...register("title")} />,
}));

vi.mock("./hero-form/cta-fields", () => ({ HeroCtaFields: () => null }));
vi.mock("./hero-form/appearance-fields", () => ({
  HeroAppearanceFields: ({
    register,
  }: {
    register: (name: "starts_at" | "ends_at") => object;
  }) => (
    <>
      <input aria-label="شروع نمایش" {...register("starts_at")} />
      <input aria-label="پایان نمایش" {...register("ends_at")} />
    </>
  ),
}));

vi.mock("./hero-form/responsive-media-fields", () => ({
  HeroResponsiveMediaFields: ({
    desktopRef,
    mobileRef,
    onDesktopStagedChange,
  }: {
    desktopRef: React.Ref<ContentImageHandle>;
    mobileRef: React.Ref<ContentImageHandle>;
    onDesktopStagedChange: (staged: boolean) => void;
  }) => {
    const initialized = React.useRef(false);
    React.useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;
      if (typeof desktopRef === "function") {
        desktopRef({
          hasStaged: true,
          isBusy: false,
          validate: () => null,
          flush: desktopFlushMock,
        });
      } else if (desktopRef) {
        desktopRef.current = {
          hasStaged: true,
          isBusy: false,
          validate: () => null,
          flush: desktopFlushMock,
        };
      }
      if (typeof mobileRef === "function") {
        mobileRef({
          hasStaged: false,
          isBusy: false,
          validate: () => null,
          flush: vi.fn(),
        });
      } else if (mobileRef) {
        mobileRef.current = {
          hasStaged: false,
          isBusy: false,
          validate: () => null,
          flush: vi.fn(),
        };
      }
      onDesktopStagedChange(true);
    });
    return <p>فایل دسکتاپ آماده است</p>;
  },
}));

vi.mock("./hero-form/hero-preview", () => ({
  HeroPreviewPanel: ({ submitLabel }: { submitLabel: string }) => (
    <button type="submit">{submitLabel}</button>
  ),
}));

import { HeroForm } from "./hero-form";

afterEach(cleanup);

beforeEach(() => {
  createHeroSlideMock.mockReset();
  updateHeroSlideMock.mockReset();
  desktopFlushMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  createHeroSlideMock.mockResolvedValue({ id: 41, image_url: null });
  updateHeroSlideMock.mockResolvedValue({ id: 41 });
  desktopFlushMock.mockResolvedValue({
    url: "/media/hero-slides/41/desktop-image.webp",
    key: "hero-slides/41/desktop-image.webp",
    width: 2400,
    height: 1350,
  });
});

describe("HeroForm owner-aware media", () => {
  it("creates an inactive draft, attaches desktop media, then activates it", async () => {
    render(<HeroForm mode="create" submitLabel="ذخیره" />);
    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "اسلاید محلی" },
    });
    fireEvent.change(screen.getByLabelText("شروع نمایش"), {
      target: { value: "2026-08-01T09:30:00" },
    });
    fireEvent.change(screen.getByLabelText("پایان نمایش"), {
      target: { value: "2026-08-15T18:45:00" },
    });
    await screen.findByText("فایل دسکتاپ آماده است");
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() => expect(createHeroSlideMock).toHaveBeenCalledTimes(1));
    expect(createHeroSlideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "اسلاید محلی",
        image_url: null,
        is_active: false,
        starts_at: new Date("2026-08-01T09:30:00").toISOString(),
        ends_at: new Date("2026-08-15T18:45:00").toISOString(),
      }),
    );
    expect(desktopFlushMock).toHaveBeenCalledWith(41);
    expect(updateHeroSlideMock).toHaveBeenCalledWith(41, {
      is_active: true,
    });
    expect(pushMock).toHaveBeenCalledWith("/admin/hero-slides");
  });

  it("omits unchanged schedule fields so DST offsets are preserved on edit", async () => {
    const slide: AdminHeroSlide = {
      id: 41,
      title: "اسلاید موجود",
      eyebrow: null,
      subtitle: null,
      badge: null,
      image_url: "/media/hero.webp",
      mobile_image_url: null,
      image_alt: null,
      cta_label: null,
      cta_href: null,
      secondary_cta_label: null,
      secondary_cta_href: null,
      theme: "dark",
      sort_order: 0,
      is_active: true,
      starts_at: "2026-11-01T06:30:00.000Z",
      ends_at: "2026-11-02T06:30:00.000Z",
      created_at: "2026-07-27T00:00:00.000Z",
      updated_at: "2026-07-27T00:00:00.000Z",
    };
    render(<HeroForm mode="edit" slide={slide} submitLabel="ذخیرهٔ تغییرات" />);
    await screen.findByText("فایل دسکتاپ آماده است");

    fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));

    await waitFor(() => expect(updateHeroSlideMock).toHaveBeenCalledTimes(1));
    const payload = updateHeroSlideMock.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty("starts_at");
    expect(payload).not.toHaveProperty("ends_at");
    expect(payload).not.toHaveProperty("sort_order");
  });
});
