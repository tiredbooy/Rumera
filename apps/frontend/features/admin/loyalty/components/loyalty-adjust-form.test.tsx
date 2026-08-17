// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { LoyaltyAdjustForm } from "./loyalty-adjust-form";

const userId = "8b5948a0-d150-4c78-86cd-d16e63da940d";

describe("LoyaltyAdjustForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            user_id: userId,
            points_balance: 1250,
            lifetime_points: 3550,
            tier: "silver",
            delta: 50,
            replayed: false,
            idempotency_key: "key-1",
          },
        }),
      }),
    );
  });

  it("renders nothing without adjust capability", () => {
    const { container } = render(
      <LoyaltyAdjustForm userId={userId} userLabel="Ali" canAdjust={false} />,
    );
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("loyalty-adjust-form")).toBeNull();
  });

  it("posts grant payload with UUID, delta, note, and Idempotency-Key", async () => {
    render(
      <LoyaltyAdjustForm userId={userId} userLabel="جین دو" canAdjust />,
    );

    expect(screen.getByTestId("loyalty-adjust-user-id")).toHaveProperty(
      "value",
      userId,
    );

    fireEvent.change(screen.getByTestId("loyalty-adjust-delta"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByTestId("loyalty-adjust-note"), {
      target: { value: "goodwill after delay" },
    });
    fireEvent.click(screen.getByTestId("loyalty-adjust-submit"));

    expect(await screen.findByTestId("loyalty-adjust-confirm")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("loyalty-adjust-confirm-action"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(
      `/api/admin/admin/users/${userId}/loyalty/adjust`,
    );
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBeTruthy();
    expect(headers["Idempotency-Key"].length).toBeGreaterThanOrEqual(8);
    const body = JSON.parse(String(init.body)) as {
      delta: number;
      note: string;
      idempotency_key: string;
    };
    expect(body.delta).toBe(50);
    expect(body.note).toBe("goodwill after delay");
    expect(body.idempotency_key).toBe(headers["Idempotency-Key"]);
    expect(toast.success).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("posts a negative delta for clawback", async () => {
    render(
      <LoyaltyAdjustForm userId={userId} userLabel="جین دو" canAdjust />,
    );

    fireEvent.change(screen.getByTestId("loyalty-adjust-delta"), {
      target: { value: "-30" },
    });
    fireEvent.click(screen.getByTestId("loyalty-adjust-submit"));
    fireEvent.click(await screen.findByTestId("loyalty-adjust-confirm-action"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { delta: number };
    expect(body.delta).toBe(-30);
  });

  it("accepts Persian digits and a ledger-style signed amount", async () => {
    render(
      <LoyaltyAdjustForm userId={userId} userLabel="جین دو" canAdjust />,
    );

    fireEvent.change(screen.getByTestId("loyalty-adjust-delta"), {
      target: { value: "−۳۰" },
    });
    fireEvent.click(screen.getByTestId("loyalty-adjust-submit"));
    fireEvent.click(await screen.findByTestId("loyalty-adjust-confirm-action"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { delta: number };
    expect(body.delta).toBe(-30);
  });

  it("does not open confirm for a zero delta", () => {
    render(
      <LoyaltyAdjustForm userId={userId} userLabel="جین دو" canAdjust />,
    );
    fireEvent.change(screen.getByTestId("loyalty-adjust-delta"), {
      target: { value: "0" },
    });
    expect(
      (screen.getByTestId("loyalty-adjust-submit") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("loyalty-adjust-confirm")).toBeNull();
  });
});