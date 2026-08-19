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
  query: vi.fn(),
  clipboard: { writeText: vi.fn() },
  toastSuccess: vi.fn(),
}));

vi.mock("@/features/payments/hooks", () => ({
  useAdminPayment: () => mocks.query(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

import { PaymentApiError } from "@/features/payments/api/admin-client";
import { PaymentDetailView } from "./payment-detail-view";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: mocks.clipboard,
  });
});

describe("PaymentDetailView", () => {
  it("distinguishes a missing payment from a retryable transport failure", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      error: new PaymentApiError(404, "NOT_FOUND", "not found"),
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<PaymentDetailView paymentID={404} />);

    expect(screen.getByRole("alert")).toHaveTextContent("این تراکنش پیدا نشد");
    expect(
      screen.queryByRole("button", { name: "تلاش دوباره" }),
    ).not.toBeInTheDocument();
  });

  it("renders exact details, decodes raw JSON, and copies the gateway id", async () => {
    mocks.query.mockReturnValue({
      data: {
        id: 51,
        order_id: 9,
        user_id: "11111111-1111-1111-1111-111111111111",
        amount: "123456789012345678.90",
        currency: "IRT",
        status: "succeeded",
        payment_method: "gateway",
        transaction_id: "gateway-51",
        raw_response: Buffer.from('{"approved":true}').toString("base64"),
        paid_at: "2026-07-29T12:01:00Z",
        created_at: "2026-07-29T12:00:00Z",
      },
      error: null,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });

    render(<PaymentDetailView paymentID={51} />);

    // D-2: trailing zeros are trimmed, so the same card reads the same here and
    // on the customer's own screen no matter how many decimal places the column
    // happened to send back.
    expect(
      screen.getByText("۱۲۳٬۴۵۶٬۷۸۹٬۰۱۲٬۳۴۵٬۶۷۸٫۹ تومان"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "11111111-1111-1111-1111-111111111111",
      }),
    ).toHaveAttribute(
      "href",
      "/admin/customers/11111111-1111-1111-1111-111111111111",
    );
    fireEvent.click(screen.getByText("پاسخ خام درگاه"));
    expect(screen.getByText(/"approved": true/)).toBeInTheDocument();
    expect(screen.queryByText("#7")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "کپی شناسهٔ تراکنش" }));
    await waitFor(() =>
      expect(mocks.clipboard.writeText).toHaveBeenCalledWith("gateway-51"),
    );
  });
});
