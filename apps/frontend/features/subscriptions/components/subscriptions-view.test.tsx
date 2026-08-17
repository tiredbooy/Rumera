// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Address } from "@/features/addresses/types";
import type { Subscription } from "@/features/subscriptions/types";

const fixtures = vi.hoisted(() => {
  const home: Address = {
    id: 11,
    title: "خانه",
    full_name: "علی رضایی",
    address_line1: "خیابان یک",
    city: "تهران",
    postal_code: "11111",
    country: "IR",
    is_default: true,
  };
  const office: Address = {
    id: 22,
    title: "دفتر",
    full_name: "علی رضایی",
    address_line1: "خیابان دو",
    city: "اصفهان",
    postal_code: "22222",
    country: "IR",
    is_default: false,
  };
  const activeBox: Subscription = {
    id: 7,
    plan: "cellar-box",
    cadence: "monthly",
    status: "active",
    address_id: home.id,
    next_renewal_at: "2026-09-01T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
  };
  return {
    home,
    office,
    addressBook: [home, office],
    activeBox,
    mutate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/features/subscriptions/hooks", () => ({
  useSubscriptions: () => ({
    data: [fixtures.activeBox],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateSubscription: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useUpdateSubscription: () => ({
    isPending: false,
    mutate: fixtures.mutate,
  }),
}));

vi.mock("@/features/addresses/api", () => ({
  useAddresses: () => ({
    data: fixtures.addressBook,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: fixtures.toastSuccess,
    error: fixtures.toastError,
  },
}));

import { SubscriptionsView } from "./subscriptions-view";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SubscriptionsView address change (PR-035b)", () => {
  it("PATCHes address_id alone and toasts success only after the mutation succeeds", () => {
    render(<SubscriptionsView />);

    fireEvent.change(screen.getByLabelText("تغییر آدرس ارسال"), {
      target: { value: String(fixtures.office.id) },
    });

    expect(fixtures.mutate).toHaveBeenCalledTimes(1);
    const [payload, opts] = fixtures.mutate.mock.calls[0] as [
      { id: number; address_id?: number; action?: string },
      {
        onSuccess?: () => void;
        onError?: (error: unknown) => void;
      },
    ];
    expect(payload).toEqual({
      id: fixtures.activeBox.id,
      address_id: fixtures.office.id,
    });
    expect(payload).not.toHaveProperty("action");

    expect(fixtures.toastSuccess).not.toHaveBeenCalled();
    opts.onSuccess?.();
    expect(fixtures.toastSuccess).toHaveBeenCalledWith("آدرس ارسال به‌روز شد");
    expect(fixtures.toastError).not.toHaveBeenCalled();
  });

  it("surfaces the API error and does not toast success on failure", () => {
    render(<SubscriptionsView />);

    fireEvent.change(screen.getByLabelText("تغییر آدرس ارسال"), {
      target: { value: String(fixtures.office.id) },
    });

    const opts = fixtures.mutate.mock.calls[0][1] as {
      onError?: (error: unknown) => void;
    };
    opts.onError?.(new Error("upstream"));

    expect(fixtures.toastError).toHaveBeenCalled();
    expect(fixtures.toastSuccess).not.toHaveBeenCalled();
  });
});
