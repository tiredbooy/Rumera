// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useShippingMethods: vi.fn(),
}));

vi.mock("@/features/shipping/api", () => ({
  useShippingMethods: (
    region: string,
    weight: number,
    subtotal: number,
    enabled: boolean,
  ) => mocks.useShippingMethods(region, weight, subtotal, enabled),
}));

import { ShippingQuoteSimulator } from "./shipping-quote-simulator";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useShippingMethods.mockReturnValue({
    isLoading: false,
    isError: false,
    isSuccess: false,
    isFetching: false,
    data: undefined,
    refetch: vi.fn(),
  });
});

describe("ShippingQuoteSimulator", () => {
  it("does not query until the operator submits parameters", () => {
    render(<ShippingQuoteSimulator defaultRegion="IR-TEH" />);
    expect(mocks.useShippingMethods).toHaveBeenLastCalledWith(
      "",
      0,
      0,
      false,
    );
  });

  it("submits region, weight, and subtotal to the available-methods hook", () => {
    mocks.useShippingMethods.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      data: [
        {
          id: 1,
          name: "پست",
          rate_type: "flat_rate",
          base_rate: 100,
          is_active: true,
          estimated_cost: 150000,
        },
      ],
      refetch: vi.fn(),
    });

    render(<ShippingQuoteSimulator defaultRegion="ir-teh" />);
    fireEvent.change(screen.getByLabelText("وزن بسته (کیلوگرم)"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ سبد (تومان)"), {
      target: { value: "3000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "محاسبه از سرور" }));

    expect(mocks.useShippingMethods).toHaveBeenLastCalledWith(
      "IR-TEH",
      2,
      3000000,
      true,
    );
    expect(screen.getByText("پست")).toBeInTheDocument();
  });
});
