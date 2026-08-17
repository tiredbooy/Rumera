// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LoyaltyAccount } from "../types";

const mocks = vi.hoisted(() => ({
  useLoyalty: vi.fn(),
  useLoyaltyTransactions: vi.fn(),
  useRedeemPoints: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("../hooks", () => ({
  useLoyalty: () => mocks.useLoyalty(),
  useLoyaltyTransactions: () => mocks.useLoyaltyTransactions(),
  useRedeemPoints: () => mocks.useRedeemPoints(),
}));

vi.mock("../api", () => ({
  newLoyaltyIdempotencyKey: () => "test-idem-key",
}));

import { RewardsView } from "./rewards-view";

function account(over: Partial<LoyaltyAccount> = {}): LoyaltyAccount {
  return {
    points_balance: 40,
    lifetime_points: 40,
    tier: "bronze",
    next_tier: "silver",
    points_to_next: 960,
    redeem_value: 500,
    ...over,
  };
}

function readyLoyalty(data: LoyaltyAccount) {
  return {
    isLoading: false,
    isError: false,
    data,
    error: null,
    refetch: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RewardsView redeem rate (PR-003l)", () => {
  it("previews wallet credit at 500 Toman/point from GET /loyalty", () => {
    mocks.useLoyalty.mockReturnValue(readyLoyalty(account({ redeem_value: 500 })));
    mocks.useLoyaltyTransactions.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      error: null,
      refetch: vi.fn(),
    });
    mocks.useRedeemPoints.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });

    render(<RewardsView />);

    expect(screen.getByText(/هر امتیاز معادل ۵۰۰ تومان/)).toBeInTheDocument();
    expect(screen.queryByText(/هر امتیاز معادل ۱٬۰۰۰ تومان/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("تعداد امتیاز برای بازخرید"), {
      target: { value: "2" },
    });

    expect(screen.getByText(/≈ ۱٬۰۰۰ تومان/)).toBeInTheDocument();
    expect(screen.queryByText(/≈ ۲٬۰۰۰ تومان/)).not.toBeInTheDocument();
  });

  it("shows a dash when redeem_value is missing — does not invent 1000", () => {
    mocks.useLoyalty.mockReturnValue(
      readyLoyalty(account({ redeem_value: undefined })),
    );
    mocks.useLoyaltyTransactions.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
      error: null,
      refetch: vi.fn(),
    });
    mocks.useRedeemPoints.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });

    render(<RewardsView />);

    expect(screen.getByText(/هر امتیاز معادل — اعتبار/)).toBeInTheDocument();
    expect(screen.queryByText(/هر امتیاز معادل ۱٬۰۰۰ تومان/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("تعداد امتیاز برای بازخرید"), {
      target: { value: "2" },
    });

    expect(screen.getByText("≈ —")).toBeInTheDocument();
    expect(screen.queryByText(/≈ ۲٬۰۰۰ تومان/)).not.toBeInTheDocument();
  });
});
