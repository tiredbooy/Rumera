// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { faNum } from "@/lib/products";
import type { ProductAlert } from "../types";

const fixtures = vi.hoisted(() => {
  const restock: ProductAlert = {
    id: 7,
    product_variant_id: 42,
    alert_type: "restock",
    target_price: null,
    notified_at: null,
    created_at: "2026-08-01T00:00:00Z",
  };
  const priceDrop: ProductAlert = {
    id: 8,
    product_variant_id: 99,
    alert_type: "price_drop",
    target_price: 18900,
    notified_at: "2026-08-10T00:00:00Z",
    created_at: "2026-08-02T00:00:00Z",
    product_title: "بطری شیراز",
    product_slug: "shiraz",
  };
  return {
    restock,
    priceDrop,
    query: {
      data: [restock, priceDrop] as ProductAlert[] | undefined,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    },
    mutate: vi.fn(),
    isPending: false,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("../hooks", () => ({
  useProductAlerts: () => fixtures.query,
  useDeleteProductAlert: () => ({
    mutate: fixtures.mutate,
    isPending: fixtures.isPending,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: fixtures.toastSuccess,
    error: fixtures.toastError,
  },
}));

import { AlertsView } from "./alerts-view";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.query.data = [fixtures.restock, fixtures.priceDrop];
  fixtures.query.isLoading = false;
  fixtures.query.isError = false;
  fixtures.query.isFetching = false;
  fixtures.isPending = false;
});

describe("AlertsView", () => {
  it("lists alerts without inventing a product title for variant-only rows", () => {
    render(<AlertsView />);

    expect(screen.getByText(`تنوع #${faNum(42)}`)).toBeInTheDocument();
    expect(screen.getByText("اطلاع از موجود شدن")).toBeInTheDocument();
    expect(screen.getByText("در انتظار")).toBeInTheDocument();

    const titled = screen.getByRole("link", { name: "بطری شیراز" });
    expect(titled).toHaveAttribute("href", "/products/shiraz");
    expect(screen.getByText("اطلاع از کاهش قیمت")).toBeInTheDocument();
    expect(screen.getByText("ارسال‌شده")).toBeInTheDocument();
  });

  it("shows an honest empty state", () => {
    fixtures.query.data = [];
    render(<AlertsView />);

    expect(screen.getByText("هنوز اعلانی ثبت نکرده‌اید")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "کشف محصولات" }),
    ).toHaveAttribute("href", "/products");
  });

  it("shows an error with retry", () => {
    fixtures.query.isError = true;
    fixtures.query.data = undefined;
    render(<AlertsView />);

    expect(screen.getByText("خطا در دریافت اعلان‌ها")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(fixtures.query.refetch).toHaveBeenCalled();
  });

  it("asks for confirmation before deleting", () => {
    render(<AlertsView />);

    fireEvent.click(
      screen.getByRole("button", {
        name: `حذف اعلان تنوع #${faNum(42)}`,
      }),
    );
    expect(screen.getByRole("heading", { name: "حذف اعلان" })).toBeInTheDocument();
    expect(fixtures.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(fixtures.mutate).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: `حذف اعلان تنوع #${faNum(42)}`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "حذف" }));

    expect(fixtures.mutate).toHaveBeenCalledTimes(1);
    const [id] = fixtures.mutate.mock.calls[0] as [number];
    expect(id).toBe(fixtures.restock.id);
  });

  it("toasts success only after delete succeeds", () => {
    render(<AlertsView />);

    fireEvent.click(
      screen.getByRole("button", {
        name: `حذف اعلان تنوع #${faNum(42)}`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "حذف" }));

    const opts = fixtures.mutate.mock.calls[0][1] as {
      onSuccess?: () => void;
      onError?: () => void;
    };
    expect(fixtures.toastSuccess).not.toHaveBeenCalled();
    opts.onSuccess?.();
    expect(fixtures.toastSuccess).toHaveBeenCalledWith("اعلان حذف شد");
    expect(fixtures.toastError).not.toHaveBeenCalled();
  });
});
