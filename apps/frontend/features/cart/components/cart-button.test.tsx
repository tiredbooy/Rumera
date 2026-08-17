// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useCart: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}));

vi.mock("@/features/cart/api", () => ({
  useCart: () => mocks.useCart(),
}));

import { CartButton } from "./cart-button";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useSession.mockReturnValue({ status: "authenticated" });
});

describe("CartButton accessible count", () => {
  it("puts the item count in the trigger name", () => {
    mocks.useCart.mockReturnValue({
      data: { summary: { total_items: 9, subtotal: 0 } },
    });

    render(<CartButton />);

    expect(
      screen.getByRole("button", { name: "سبد خرید، ۹ قلم" }),
    ).toBeInTheDocument();
  });

  it("announces count changes in a polite live region", () => {
    mocks.useCart.mockReturnValue({
      data: { summary: { total_items: 1, subtotal: 0 } },
    });

    const { rerender } = render(<CartButton />);
    expect(screen.getByRole("button", { name: "سبد خرید، ۱ قلم" })).toBeInTheDocument();
    expect(screen.queryByText("سبد خرید، ۲ قلم")).not.toBeInTheDocument();

    mocks.useCart.mockReturnValue({
      data: { summary: { total_items: 2, subtotal: 0 } },
    });
    rerender(<CartButton />);

    const live = screen.getByText("سبد خرید، ۲ قلم", { selector: "[aria-live='polite']" });
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByRole("button", { name: "سبد خرید، ۲ قلم" }),
    ).toBeInTheDocument();
  });
});
