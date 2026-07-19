// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/features/coupons/api", () => {
  class CouponApiError extends Error {}
  return {
    CouponApiError,
    useCreateAdminCoupon: () => ({
      mutateAsync: mocks.create,
      isPending: false,
    }),
    useUpdateAdminCoupon: () => ({
      mutateAsync: mocks.update,
      isPending: false,
    }),
  };
});

import { CouponForm } from "./coupon-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: 1 });
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("CouponForm", () => {
  it("focuses invalid discount values and blocks submission", async () => {
    render(<CouponForm mode="create" />);

    fireEvent.change(screen.getByLabelText("کد تخفیف"), {
      target: { value: "TOO-MUCH" },
    });
    const discount = screen.getByLabelText("درصد تخفیف");
    fireEvent.change(discount, { target: { value: "101" } });
    fireEvent.submit(discount.closest("form")!);

    expect(
      await screen.findByText("درصد باید عددی بین ۰ تا ۱۰۰ باشد"),
    ).toBeInTheDocument();
    expect(discount).toHaveFocus();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("submits a normalized create payload", async () => {
    render(<CouponForm mode="create" />);

    fireEvent.change(screen.getByLabelText("کد تخفیف"), {
      target: { value: " summer " },
    });
    fireEvent.change(screen.getByLabelText("درصد تخفیف"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت کد تخفیف" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      code: "SUMMER",
      discount_type: "percentage",
      discount_value: 20,
      min_order_amount: 0,
      max_uses_per_user: 1,
      applicable_to: null,
      is_active: true,
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/coupons");
  });
});
