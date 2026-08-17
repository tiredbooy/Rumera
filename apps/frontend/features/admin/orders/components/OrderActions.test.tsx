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

import { AdminOrderClientError } from "@/features/orders/api/admin-client";
import { ORDER_STATUS_FA } from "@/features/orders/labels";
import type { OrderStatus } from "@/features/orders/types";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  updateMutate: vi.fn(),
  refundMutate: vi.fn(),
  updatePending: false,
  refundPending: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

vi.mock("@/features/admin/orders/hooks", () => ({
  useUpdateAdminOrderStatus: () => ({
    mutateAsync: mocks.updateMutate,
    isPending: mocks.updatePending,
  }),
  useRefundAdminOrder: () => ({
    mutateAsync: mocks.refundMutate,
    isPending: mocks.refundPending,
  }),
}));

import { OrderActions } from "./OrderActions";

const COMMAND_ONLY: OrderStatus[] = [
  "paid",
  "cancelled",
  "refunded",
  "partially_refunded",
  "refund_approved",
  "refund_requested",
];

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updatePending = false;
  mocks.refundPending = false;
  mocks.updateMutate.mockResolvedValue({ id: 9, status: "processing" });
  mocks.refundMutate.mockResolvedValue({ id: 9, status: "refunded" });
  window.print = vi.fn();
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
});

async function openWarehouseSelect() {
  fireEvent.click(screen.getByTestId("order-fulfill-status"));
  await screen.findAllByRole("option");
}

function optionNames(): string[] {
  return screen.getAllByRole("option").map((el) => el.textContent ?? "");
}

function enabledOptionNames(): string[] {
  return screen
    .getAllByRole("option")
    .filter((el) => {
      if (el.hasAttribute("data-disabled")) return false;
      return el.getAttribute("aria-disabled") !== "true";
    })
    .map((el) => el.textContent ?? "");
}

describe("OrderActions", () => {
  it("keeps print without write and hides warehouse + refund", () => {
    render(<OrderActions orderId={9} status="paid" canWrite={false} />);

    expect(
      screen.getByRole("button", { name: /چاپ فاکتور/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("order-fulfill-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-refund-trigger")).not.toBeInTheDocument();
  });

  it("from paid, only processing is a hop — refunded/cancelled are absent", async () => {
    render(<OrderActions orderId={9} status="paid" canWrite />);

    await openWarehouseSelect();

    expect(enabledOptionNames()).toEqual([ORDER_STATUS_FA.processing]);
    expect(optionNames()).not.toContain(ORDER_STATUS_FA.refunded);
    expect(optionNames()).not.toContain(ORDER_STATUS_FA.cancelled);
    expect(optionNames()).not.toContain(ORDER_STATUS_FA.partially_refunded);
    expect(
      screen.getByRole("option", { name: ORDER_STATUS_FA.paid }),
    ).toHaveAttribute("data-disabled");
  });

  it("from processing, never offers paid or refund-family as hops", async () => {
    render(<OrderActions orderId={9} status="processing" canWrite />);

    await openWarehouseSelect();

    const enabled = enabledOptionNames();
    expect(enabled).toEqual([
      ORDER_STATUS_FA.ready_to_ship,
      ORDER_STATUS_FA.shipped,
    ]);
    for (const status of COMMAND_ONLY) {
      expect(enabled).not.toContain(ORDER_STATUS_FA[status]);
    }
  });

  it("PATCHes a warehouse hop and toasts only after success", async () => {
    render(<OrderActions orderId={9} status="paid" canWrite />);

    await openWarehouseSelect();
    fireEvent.click(
      screen.getByRole("option", { name: ORDER_STATUS_FA.processing }),
    );

    await waitFor(() =>
      expect(mocks.updateMutate).toHaveBeenCalledWith({ status: "processing" }),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      `وضعیت سفارش به «${ORDER_STATUS_FA.processing}» تغییر کرد`,
    );
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.refundMutate).not.toHaveBeenCalled();
  });

  it("rolls back and toasts the real error when status PATCH fails", async () => {
    mocks.updateMutate.mockRejectedValue(
      new AdminOrderClientError(409, "INVALID_STATE", "illegal transition"),
    );

    render(<OrderActions orderId={9} status="paid" canWrite />);

    await openWarehouseSelect();
    fireEvent.click(
      screen.getByRole("option", { name: ORDER_STATUS_FA.processing }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("illegal transition"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("asks before marking an order delivered", async () => {
    render(<OrderActions orderId={9} status="shipped" canWrite />);

    await openWarehouseSelect();
    fireEvent.click(
      screen.getByRole("option", { name: ORDER_STATUS_FA.delivered }),
    );

    expect(mocks.updateMutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "ثبت تحویل؟" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("order-deliver-confirm"));
    await waitFor(() =>
      expect(mocks.updateMutate).toHaveBeenCalledWith({ status: "delivered" }),
    );
  });

  it("hides the warehouse select when there is no legal hop", () => {
    render(<OrderActions orderId={9} status="delivered" canWrite />);

    expect(screen.queryByTestId("order-fulfill-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("order-refund-trigger")).toBeInTheDocument();
  });

  it("does not offer refund on pending or already-refunded orders", () => {
    const { rerender } = render(
      <OrderActions orderId={9} status="pending" canWrite />,
    );
    expect(screen.queryByTestId("order-refund-trigger")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-fulfill-status")).not.toBeInTheDocument();

    rerender(<OrderActions orderId={9} status="refunded" canWrite />);
    expect(screen.queryByTestId("order-refund-trigger")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-fulfill-status")).not.toBeInTheDocument();
  });

  it("requires confirm before POSTing the refund command", async () => {
    render(<OrderActions orderId={9} status="paid" canWrite />);

    fireEvent.click(screen.getByTestId("order-refund-trigger"));
    expect(mocks.refundMutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "ثبت بازپرداخت؟" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("order-refund-confirm"));

    await waitFor(() => expect(mocks.refundMutate).toHaveBeenCalledTimes(1));
    expect(mocks.success).toHaveBeenCalledWith("بازپرداخت ثبت شد");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.updateMutate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("order-refund-trigger")).not.toBeInTheDocument();
  });

  it("toasts the API error and does not fake refund success", async () => {
    mocks.refundMutate.mockRejectedValue(
      new AdminOrderClientError(409, "CONFLICT", "order is already refunded"),
    );

    render(<OrderActions orderId={9} status="processing" canWrite />);

    fireEvent.click(screen.getByTestId("order-refund-trigger"));
    fireEvent.click(screen.getByTestId("order-refund-confirm"));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("order is already refunded"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("order-refund-trigger")).toBeInTheDocument();
  });
});
