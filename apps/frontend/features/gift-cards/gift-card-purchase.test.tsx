// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GiftCardPurchaseIntent } from "./types";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./hooks", () => ({
  usePurchaseGiftCard: () => ({
    mutate: mocks.mutate,
    isPending: false,
  }),
}));

import { GiftCardPurchase } from "./gift-card-purchase";

const baseIntent: GiftCardPurchaseIntent = {
  payment_id: 9,
  transaction_id: "gbuy-xyz",
  amount: "100000",
  currency: "IRT",
  status: "pending",
};

function submitWithIntent(intent: GiftCardPurchaseIntent) {
  mocks.mutate.mockImplementation((_input, opts) => {
    opts?.onSuccess?.(intent);
  });
  render(<GiftCardPurchase />);
  fireEvent.submit(screen.getByTestId("gift-card-purchase-form"));
}

afterEach(() => {
  cleanup();
  mocks.mutate.mockReset();
});

describe("GiftCardPurchase pending pay CTA (PR-030c)", () => {
  it("links «پرداخت در درگاه» to the API payment_url in the same window", () => {
    const href =
      "https://pay.example.com/start?transaction_id=gbuy-xyz";
    submitWithIntent({ ...baseIntent, payment_url: href });

    expect(
      screen.getByTestId("gift-card-purchase-pending"),
    ).toBeInTheDocument();
    const pay = screen.getByRole("link", { name: /پرداخت در درگاه/ });
    expect(pay).toHaveAttribute("href", href);
    expect(pay).not.toHaveAttribute("target");
  });

  it("keeps pending copy and does not invent a pay URL when missing", () => {
    submitWithIntent(baseIntent);

    expect(
      screen.getByTestId("gift-card-purchase-pending"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /پرداخت در درگاه/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("gift-card-purchase-pay"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/پرداخت را در درگاه با همین شناسه تکمیل کنید/),
    ).toBeInTheDocument();
  });

  it("does not invent a pay URL when payment_url is blank", () => {
    submitWithIntent({ ...baseIntent, payment_url: "" });

    expect(
      screen.getByTestId("gift-card-purchase-pending"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /پرداخت در درگاه/ }),
    ).not.toBeInTheDocument();
  });
});
