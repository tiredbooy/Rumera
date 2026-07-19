// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock(
  "@/features/catalog/categories/components/category-thumbnail",
  () => ({ CategoryThumbnail: () => <span aria-hidden /> }),
);

import { MobileNavDrawer } from "./mobile-nav-drawer";

afterEach(cleanup);

describe("MobileNavDrawer responsive shell", () => {
  it("uses the dynamic viewport and contains horizontal overflow", async () => {
    render(<MobileNavDrawer categoryTree={[]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "باز کردن منوی فروشگاه" }),
    );

    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveClass(
      "max-h-dvh",
      "overflow-x-hidden",
      "overscroll-contain",
      "data-[side=right]:h-dvh",
      "data-[side=right]:w-full",
      "data-[side=right]:max-w-[360px]",
      "data-[side=right]:sm:max-w-[360px]",
    );
    expect(dialog).not.toHaveClass(
      "data-[side=right]:h-full",
      "data-[side=right]:w-3/4",
    );
    expect(dialog.className).toContain(
      "[padding-bottom:env(safe-area-inset-bottom)]",
    );
  });
});
