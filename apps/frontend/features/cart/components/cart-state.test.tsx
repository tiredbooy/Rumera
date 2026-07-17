// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("./cart-lines", () => ({
  CartLines: () => <div data-testid="cart-lines">اقلام سبد</div>,
}));

import { CartView } from "./cart-view";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cart query states", () => {
  it.each(["loading", "authenticated"] as const)(
    "does not render an empty or signed-out state while %s is unresolved",
    (status) => {
      mocks.useSession.mockReturnValue({ status });
      mocks.useCart.mockReturnValue({
        data: undefined,
        isPending: true,
        isError: false,
        isFetching: status === "authenticated",
        refetch: vi.fn(),
      });

      render(<CartView />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "در حال دریافت سبد خرید",
      );
      expect(
        screen.queryByText("برای مشاهدهٔ سبد خرید وارد شوید"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("سبد خرید شما خالی است"),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps a failed cart read visible and retryable", () => {
    const refetch = vi.fn();
    mocks.useSession.mockReturnValue({ status: "authenticated" });
    mocks.useCart.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch,
    });

    render(<CartView />);
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "دریافت سبد خرید انجام نشد",
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cart-lines")).not.toBeInTheDocument();
  });
});
