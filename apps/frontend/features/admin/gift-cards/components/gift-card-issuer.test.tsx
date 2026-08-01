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
  issue: vi.fn(),
  clipboard: { writeText: vi.fn() },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/features/gift-cards/hooks", () => ({
  useCreateGiftCards: () => ({ mutateAsync: mocks.issue, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { GiftCardIssuer } from "./gift-card-issuer";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: mocks.clipboard,
  });
});

describe("GiftCardIssuer", () => {
  it("connects validation errors and focuses the first invalid field", async () => {
    render(<GiftCardIssuer />);
    const amount = screen.getByLabelText("مبلغ هر کارت (تومان)");
    fireEvent.change(amount, { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("تعداد کارت"), {
      target: { value: "501" },
    });
    fireEvent.click(screen.getByRole("button", { name: "صدور کارت‌ها" }));

    expect(
      await screen.findByText("مبلغ باید بیشتر از صفر باشد"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("تعداد باید بین ۱ تا ۵۰۰ باشد"),
    ).toBeInTheDocument();
    expect(amount).toHaveFocus();
    expect(amount).toHaveAttribute(
      "aria-describedby",
      "gift-card-amount-error",
    );
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it("shows the complete issued batch, moves focus, and copies all codes", async () => {
    mocks.issue.mockResolvedValue([
      {
        code: "ABCD-EFGH-JKLM-NPQR",
        initial_amount: "125000.5",
        status: "active",
        created_at: "2026-07-29T12:00:00Z",
      },
      {
        code: "RSTU-VWXY-2345-6789",
        initial_amount: "125000.5",
        status: "active",
        created_at: "2026-07-29T12:00:00Z",
      },
    ]);
    render(<GiftCardIssuer />);
    fireEvent.change(screen.getByLabelText("مبلغ هر کارت (تومان)"), {
      target: { value: "125000.50" },
    });
    fireEvent.change(screen.getByLabelText("تعداد کارت"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "صدور کارت‌ها" }));

    const heading = await screen.findByRole("heading", {
      name: "کدهای صادرشده",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(mocks.issue).toHaveBeenCalledWith({
      amount: "125000.50",
      count: 2,
    });
    expect(screen.getByText("ABCD-EFGH-JKLM-NPQR")).toBeInTheDocument();
    expect(screen.getByText("RSTU-VWXY-2345-6789")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "کپی همه" }));
    await waitFor(() =>
      expect(mocks.clipboard.writeText).toHaveBeenCalledWith(
        "ABCD-EFGH-JKLM-NPQR\nRSTU-VWXY-2345-6789",
      ),
    );
  });
});
