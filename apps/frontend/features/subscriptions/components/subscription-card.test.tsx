// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Address } from "@/features/addresses/types";
import type { Subscription } from "@/features/subscriptions/types";

import { SubscriptionCard } from "./subscription-card";

const home: Address = {
  id: 11,
  title: "خانه",
  full_name: "علی رضایی",
  address_line1: "خیابان یک",
  city: "تهران",
  state_province: "تهران",
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

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 7,
    plan: "cellar-box",
    cadence: "monthly",
    status: "active",
    address_id: home.id,
    next_renewal_at: "2026-09-01T00:00:00Z",
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

const actions = {
  onRequestSkip: vi.fn(),
  onResume: vi.fn(),
  onRequestPause: vi.fn(),
  onRequestCancel: vi.fn(),
  onChangeAddress: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SubscriptionCard ship-to picker (PR-035b)", () => {
  it("shows the current address and PATCHes a new id without lifecycle action", () => {
    render(
      <ul>
        <SubscriptionCard
          sub={sub()}
          address={home}
          addresses={[home, office]}
          busy={false}
          {...actions}
        />
      </ul>,
    );

    expect(screen.getByText("خانه")).toBeInTheDocument();
    const picker = screen.getByLabelText("تغییر آدرس ارسال");
    expect(picker).toHaveValue(String(home.id));

    fireEvent.change(picker, { target: { value: String(office.id) } });

    expect(actions.onChangeAddress).toHaveBeenCalledTimes(1);
    expect(actions.onChangeAddress).toHaveBeenCalledWith(office.id);
    expect(actions.onRequestPause).not.toHaveBeenCalled();
    expect(actions.onRequestSkip).not.toHaveBeenCalled();
  });

  it("lets a paused box attach a missing ship-to", () => {
    render(
      <ul>
        <SubscriptionCard
          sub={sub({ status: "paused", address_id: undefined })}
          addresses={[home, office]}
          busy={false}
          {...actions}
        />
      </ul>,
    );

    expect(screen.getByText(/آدرسی به این باکس وصل نیست/)).toBeInTheDocument();
    const picker = screen.getByLabelText("انتخاب آدرس ارسال");
    fireEvent.change(picker, { target: { value: String(home.id) } });
    expect(actions.onChangeAddress).toHaveBeenCalledWith(home.id);
  });

  it("hides the picker on cancelled boxes", () => {
    render(
      <ul>
        <SubscriptionCard
          sub={sub({ status: "cancelled" })}
          address={home}
          addresses={[home, office]}
          busy={false}
          {...actions}
        />
      </ul>,
    );

    expect(screen.queryByLabelText("تغییر آدرس ارسال")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("انتخاب آدرس ارسال")).not.toBeInTheDocument();
    expect(screen.getByText("خانه")).toBeInTheDocument();
  });

  it("does not fire when the same address is re-selected", () => {
    render(
      <ul>
        <SubscriptionCard
          sub={sub()}
          address={home}
          addresses={[home, office]}
          busy={false}
          {...actions}
        />
      </ul>,
    );

    fireEvent.change(screen.getByLabelText("تغییر آدرس ارسال"), {
      target: { value: String(home.id) },
    });
    expect(actions.onChangeAddress).not.toHaveBeenCalled();
  });
});
