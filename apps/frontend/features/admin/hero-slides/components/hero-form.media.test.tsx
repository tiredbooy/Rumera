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

import type { FlexibleImageInputHandle } from "@/features/admin/uploads/types";

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
  HeroAppearanceFields: () => null,
}));

vi.mock("./hero-form/responsive-media-fields", () => ({
  HeroResponsiveMediaFields: ({
    desktopRef,
    mobileRef,
    onDesktopStagedChange,
  }: {
    desktopRef: React.Ref<FlexibleImageInputHandle>;
    mobileRef: React.Ref<FlexibleImageInputHandle>;
    onDesktopStagedChange: (staged: boolean) => void;
  }) => {
    const initialized = React.useRef(false);
    React.useEffect(() => {
      if (initialized.current) return;
      initialized.current = true;
      if (typeof desktopRef === "function") {
        desktopRef({ hasStaged: true, flush: desktopFlushMock });
      } else if (desktopRef) {
        desktopRef.current = {
          hasStaged: true,
          flush: desktopFlushMock,
        };
      }
      if (typeof mobileRef === "function") {
        mobileRef({ hasStaged: false, flush: vi.fn() });
      } else if (mobileRef) {
        mobileRef.current = { hasStaged: false, flush: vi.fn() };
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
    await screen.findByText("فایل دسکتاپ آماده است");
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() => expect(createHeroSlideMock).toHaveBeenCalledTimes(1));
    expect(createHeroSlideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "اسلاید محلی",
        image_url: null,
        is_active: false,
      }),
    );
    expect(desktopFlushMock).toHaveBeenCalledWith(41);
    expect(updateHeroSlideMock).toHaveBeenCalledWith(41, {
      is_active: true,
    });
    expect(pushMock).toHaveBeenCalledWith("/admin/hero-slides");
  });
});
