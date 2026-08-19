// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "authenticated",
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: mocks.status }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/features/product-alerts/hooks", () => ({
  useCreateProductAlert: () => ({ mutate: mocks.mutate }),
}));

import {
  PendingAlertIntent,
  stashAlertIntent,
  takeAlertIntent,
} from "./pending-alert";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.status = "authenticated";
});

describe("alert intent", () => {
  it("round-trips restock and rejects a bad type", () => {
    stashAlertIntent({ product_variant_id: 4, alert_type: "restock" });
    expect(takeAlertIntent()).toEqual({
      product_variant_id: 4,
      alert_type: "restock",
    });
    sessionStorage.setItem(
      "rumera_alert_intent",
      JSON.stringify({
        product_variant_id: 4,
        alert_type: "email",
        expires_at: Date.now() + 1000,
      }),
    );
    expect(takeAlertIntent()).toBeNull();
  });

  it("replays the restock alert after login", async () => {
    stashAlertIntent({ product_variant_id: 4, alert_type: "restock" });
    render(<PendingAlertIntent />);

    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        { product_variant_id: 4, alert_type: "restock" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      ),
    );
    mocks.mutate.mock.calls.at(-1)?.[1].onSuccess();
    expect(mocks.success).toHaveBeenCalledWith(
      "هنگام موجود شدن به شما اطلاع می‌دهیم",
    );
  });
});
