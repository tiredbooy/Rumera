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
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

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
            transaction: { id: 1, amount: "50000", balance_after: "175000.00" },
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

  // CF-3: this form mints ledger money. It used to do that with no balance on
  // the page, so the operator granting credit could not see what the customer
  // already had — the balance is now on the form and in the confirmation.
  it("shows the current balance on the form and in the confirmation", async () => {
    render(
      <WalletCreditForm
        userId="u1"
        userLabel="علی"
        balance="125000.00"
        canCredit
      />,
    );

    expect(screen.getByTestId("wallet-credit-balance").textContent).toContain(
      "۱۲۵٬۰۰۰",
    );

    fireEvent.change(screen.getByTestId("wallet-credit-amount"), {
      target: { value: "50000" },
    });
    fireEvent.click(screen.getByTestId("wallet-credit-submit"));

    const dialog = await screen.findByTestId("wallet-credit-confirm");
    expect(dialog.textContent).toContain("۱۲۵٬۰۰۰");
    expect(dialog.textContent).toContain("۵۰٬۰۰۰");
  });

  it("says the balance is unknown rather than zero when it was not read", () => {
    render(<WalletCreditForm userId="u1" userLabel="علی" canCredit />);
    expect(screen.getByTestId("wallet-credit-balance").textContent).toBe(
      "نامشخص",
    );
  });

  it("reports the server balance and re-reads the page after crediting", async () => {
    render(
      <WalletCreditForm
        userId="u1"
        userLabel="علی"
        balance="125000.00"
        canCredit
      />,
    );
    fireEvent.change(screen.getByTestId("wallet-credit-amount"), {
      target: { value: "50000" },
    });
    fireEvent.click(screen.getByTestId("wallet-credit-submit"));
    fireEvent.click(await screen.findByTestId("wallet-credit-confirm-action"));

    await waitFor(() => {
      expect(router.refresh).toHaveBeenCalled();
    });
    // The new balance comes from the ledger row the server wrote, never from
    // adding the amount to the displayed balance in floating point.
    const [, options] = toast.success.mock.calls[0] as [
      string,
      { description: string },
    ];
    expect(options.description).toContain("۱۷۵٬۰۰۰");
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
