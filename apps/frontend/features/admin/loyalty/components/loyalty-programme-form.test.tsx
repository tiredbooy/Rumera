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
  update: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("../api/client", () => {
  class LoyaltyApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly fields?: Record<string, string[]>,
    ) {
      super(message);
    }
  }
  return { LoyaltyApiError, updateLoyaltyProgramme: mocks.update };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { LoyaltyProgrammeForm } from "./loyalty-programme-form";
import type { LoyaltyProgramme } from "../types";

const programme: LoyaltyProgramme = {
  config_source: "db",
  editable: true,
  enabled: true,
  earn_divisor: 10000,
  redeem_value: 1000,
  signup_bonus: 100,
  review_bonus: 50,
  birthday_bonus: 200,
  birthday_tz: "Asia/Tehran",
  referral_reward: 300,
  tiers: [
    { id: "bronze", min_lifetime_points: 0 },
    { id: "silver", min_lifetime_points: 1000 },
    { id: "gold", min_lifetime_points: 5000 },
    { id: "cellar", min_lifetime_points: 20000 },
  ],
  runbook: "PUT /admin/loyalty/programme",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue(programme);
  // Radix Switch measures its thumb; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function editAndSave(label: RegExp, value: string) {
  render(<LoyaltyProgrammeForm programme={programme} />);
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));
}

describe("LoyaltyProgrammeForm", () => {
  it("seeds every lever from the live programme", () => {
    render(<LoyaltyProgrammeForm programme={programme} />);

    expect(screen.getByLabelText(/مبلغ خرید به ازای هر امتیاز/)).toHaveValue(
      "10000",
    );
    expect(screen.getByLabelText(/ارزش هر امتیاز/)).toHaveValue("1000");
    expect(screen.getByLabelText(/منطقهٔ زمانی تولد/)).toHaveValue(
      "Asia/Tehran",
    );
    expect(screen.getByLabelText(/طلایی/)).toHaveValue("5000");
  });

  // The server validates `enabled` as required, so a save that drops it is a
  // 422 on every submit — every save carries the switch, edited or not.
  it("round-trips the kill switch when another lever is edited", async () => {
    mocks.update.mockResolvedValue({ ...programme, enabled: false });
    render(
      <LoyaltyProgrammeForm programme={{ ...programme, enabled: false }} />,
    );
    fireEvent.change(screen.getByLabelText(/هدیهٔ عضویت/), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][0].enabled).toBe(false);
  });

  // L-2: the switch the backend has always honoured is finally settable.
  it("switches the programme off and warns before the save", async () => {
    render(<LoyaltyProgrammeForm programme={programme} />);
    const toggle = screen.getByRole("switch", {
      name: /باشگاه مشتریان فعال باشد/,
    });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    expect(await screen.findByRole("status")).toHaveTextContent(
      /تنها همین صفحه در بخش باشگاه در دسترس می‌ماند/,
    );
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][0].enabled).toBe(false);
    // The rest of the programme rides along untouched — the PUT is a replace.
    expect(mocks.update.mock.calls[0][0].earn_divisor).toBe(10000);
  });

  it("switches a dark programme back on", async () => {
    render(
      <LoyaltyProgrammeForm programme={{ ...programme, enabled: false }} />,
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /باشگاه مشتریان فعال باشد/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][0].enabled).toBe(true);
  });

  it("submits numbers and the full tier list, not form strings", async () => {
    editAndSave(/هدیهٔ تولد/, "250");

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const body = mocks.update.mock.calls[0][0];
    expect(body.birthday_bonus).toBe(250);
    expect(body.earn_divisor).toBe(10000);
    expect(body.tiers).toEqual([
      { id: "bronze", min_lifetime_points: 0 },
      { id: "silver", min_lifetime_points: 1000 },
      { id: "gold", min_lifetime_points: 5000 },
      { id: "cellar", min_lifetime_points: 20000 },
    ]);
  });

  // Mirrors the server's strictly-increasing rule so the operator sees it
  // before the round trip rather than as a 422.
  it("refuses a tier threshold that does not exceed the one below", async () => {
    editAndSave(/طلایی/, "500");

    await waitFor(() =>
      expect(
        screen.getByText(/هر آستانه باید از سطح پیش از خود بزرگ‌تر باشد/),
      ).toBeInTheDocument(),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses a zero earn divisor", async () => {
    editAndSave(/مبلغ خرید به ازای هر امتیاز/, "0");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps save disabled until something changes", () => {
    render(<LoyaltyProgrammeForm programme={programme} />);

    expect(
      screen.getByRole("button", { name: /ذخیرهٔ تغییرات/ }),
    ).toBeDisabled();
  });

  it("surfaces a server field error on the offending input", async () => {
    const { LoyaltyApiError } = await import("../api/client");
    mocks.update.mockRejectedValue(
      new LoyaltyApiError(422, "VALIDATION", "ورودی نامعتبر", {
        birthday_tz: ["منطقهٔ زمانی نامعتبر است"],
      }),
    );
    editAndSave(/منطقهٔ زمانی تولد/, "Mars/Olympus");

    await waitFor(() =>
      expect(
        screen.getByText("منطقهٔ زمانی نامعتبر است"),
      ).toBeInTheDocument(),
    );
  });
});
