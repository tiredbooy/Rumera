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

vi.mock("sonner", () => ({ toast }));

import { WalletCreditForm } from "./wallet-credit-form";

describe("WalletCreditForm", () => {
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
            transaction: { id: 1, amount: "50000" },
            actor_user_id: "actor-1",
            idempotency_key: "key-1",
            replayed: false,
          },
        }),
      }),
    );
  });

  it("renders nothing without credit capability", () => {
    const { container } = render(
      <WalletCreditForm userId="u1" userLabel="Ali" canCredit={false} />,
    );
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("wallet-credit-form")).toBeNull();
  });

  it("requires confirmation before posting credit", async () => {
    render(<WalletCreditForm userId="u1" userLabel="علی" canCredit />);

    fireEvent.change(screen.getByTestId("wallet-credit-amount"), {
      target: { value: "50000" },
    });
    fireEvent.click(screen.getByTestId("wallet-credit-submit"));

    expect(await screen.findByTestId("wallet-credit-confirm")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("wallet-credit-confirm-action"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toContain("/api/admin/admin/users/u1/wallet/credit");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBeTruthy();
    const body = JSON.parse(String(init.body)) as {
      amount: number;
      idempotency_key: string;
    };
    expect(body.amount).toBe(50000);
    expect(body.idempotency_key).toBe(headers["Idempotency-Key"]);
    expect(toast.success).toHaveBeenCalled();
  });

  it("does not open confirm for invalid amount", () => {
    render(<WalletCreditForm userId="u1" userLabel="علی" canCredit />);
    fireEvent.change(screen.getByTestId("wallet-credit-amount"), {
      target: { value: "0" },
    });
    expect(
      (screen.getByTestId("wallet-credit-submit") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("wallet-credit-confirm")).toBeNull();
  });
});
