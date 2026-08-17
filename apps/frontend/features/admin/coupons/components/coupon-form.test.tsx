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

// The picker queries the server as you type; these tests are about what an
// existing scope RENDERS, not about search, so the list query is stubbed.
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: false }),
}));

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

  it("translates a duplicate-code server conflict into Persian", async () => {
    mocks.create.mockRejectedValue(
      Object.assign(new Error("coupon code is already used by another coupon"), {
        status: 409,
        code: "CONFLICT",
      }),
    );
    render(<CouponForm mode="create" />);
    fireEvent.change(screen.getByLabelText("کد تخفیف"), {
      target: { value: "SUMMER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت کد تخفیف" }));

    expect(
      await screen.findByText(/این کد تخفیف قبلاً ثبت شده است/),
    ).toBeInTheDocument();
  });

  it("labels money in Tomans and previews the offer in plain language", () => {
    render(<CouponForm mode="create" />);

    fireEvent.change(screen.getByLabelText("درصد تخفیف"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("سقف مبلغ تخفیف (تومان)"), {
      target: { value: "50000" },
    });
    fireEvent.change(screen.getByLabelText("حداقل مبلغ سفارش (تومان)"), {
      target: { value: "500000" },
    });

    expect(
      screen.getByRole("status"),
    ).toHaveTextContent(
      "۱۰٪ تخفیف تا سقف ۵۰٬۰۰۰ تومان برای سفارش‌های بالای ۵۰۰٬۰۰۰ تومان",
    );
    expect(screen.getAllByText("۵۰٬۰۰۰ تومان").length).toBeGreaterThan(0);
    expect(screen.getAllByText("۵۰۰٬۰۰۰ تومان").length).toBeGreaterThan(0);
  });
});

// CF-2. A coupon scoped to a product outside the loaded window used to render
// as an EMPTY picker — no chip, no id, no warning — over a discount that was
// really applied. An operator reading that would re-scope and over-discount.
describe("coupon product scope visibility", () => {
  const scopedCoupon = {
    id: 5,
    code: "SAVE",
    description: "",
    discount_type: "percentage" as const,
    discount_value: 10,
    max_discount_amount: null,
    min_order_amount: null,
    max_uses: null,
    max_uses_per_user: null,
    used_count: 0,
    is_active: true,
    starts_at: null,
    expires_at: null,
    applicable_to: { product_ids: [500], category_ids: [] },
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  };

  it("shows a scoped product that the label lookup could not resolve", () => {
    // Seeding failed or the product was deleted: the id must still be visible.
    render(
      <CouponForm
        mode="edit"
        coupon={scopedCoupon as never}
        productOptions={[]}
      />,
    );

    expect(screen.getByText(/۵۰۰/)).toBeInTheDocument();
  });

  it("shows the real title once the by-ids lookup has seeded it", () => {
    render(
      <CouponForm
        mode="edit"
        coupon={scopedCoupon as never}
        productOptions={[{ id: 500, title: "ویسکی تک‌مالت" }]}
      />,
    );

    expect(screen.getByText("ویسکی تک‌مالت")).toBeInTheDocument();
  });
});
