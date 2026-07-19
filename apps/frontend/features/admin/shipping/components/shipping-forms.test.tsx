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
  createZone: vi.fn(),
  updateZone: vi.fn(),
  createMethod: vi.fn(),
  updateMethod: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/features/shipping/api", () => {
  class ShippingApiError extends Error {}
  return {
    ShippingApiError,
    useCreateAdminShippingZone: () => ({
      mutateAsync: mocks.createZone,
      isPending: false,
    }),
    useUpdateAdminShippingZone: () => ({
      mutateAsync: mocks.updateZone,
      isPending: false,
    }),
    useCreateAdminShippingMethod: () => ({
      mutateAsync: mocks.createMethod,
      isPending: false,
    }),
    useUpdateAdminShippingMethod: () => ({
      mutateAsync: mocks.updateMethod,
      isPending: false,
    }),
  };
});

import { ShippingMethodForm } from "./shipping-method-form";
import { ShippingZoneForm } from "./shipping-zone-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createZone.mockResolvedValue({ id: 9 });
  mocks.createMethod.mockResolvedValue({ id: 4 });
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe("shipping forms", () => {
  it("focuses an empty zone coverage field and blocks submission", async () => {
    render(<ShippingZoneForm mode="create" />);
    fireEvent.change(screen.getByLabelText("نام منطقه"), {
      target: { value: "Tehran" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت منطقه" }));

    const regions = screen.getByLabelText("کدهای منطقه");
    expect(
      await screen.findByText("حداقل یک کد منطقه وارد کنید"),
    ).toBeInTheDocument();
    expect(regions).toHaveFocus();
    expect(mocks.createZone).not.toHaveBeenCalled();
  });

  it("submits normalized zone coverage and opens the new detail", async () => {
    render(<ShippingZoneForm mode="create" />);
    fireEvent.change(screen.getByLabelText("نام منطقه"), {
      target: { value: "  Tehran  " },
    });
    fireEvent.change(screen.getByLabelText("کدهای منطقه"), {
      target: { value: " ir-teh، IR-TEH, de " },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت منطقه" }));

    await waitFor(() => expect(mocks.createZone).toHaveBeenCalledTimes(1));
    expect(mocks.createZone).toHaveBeenCalledWith({
      name: "Tehran",
      description: null,
      region_codes: ["IR-TEH", "DE"],
      is_active: true,
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/shipping/9");
  });

  it("focuses contradictory delivery rules in the method form", async () => {
    render(<ShippingMethodForm mode="create" zoneID={3} />);
    fireEvent.change(screen.getByLabelText("نام روش"), {
      target: { value: "Standard" },
    });
    fireEvent.change(screen.getByLabelText("حداقل روز تحویل"), {
      target: { value: "5" },
    });
    const maxDays = screen.getByLabelText("حداکثر روز تحویل");
    fireEvent.change(maxDays, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "ساخت روش ارسال" }));

    expect(
      await screen.findByText("حداکثر زمان نمی‌تواند کمتر از حداقل زمان باشد"),
    ).toBeInTheDocument();
    expect(maxDays).toHaveFocus();
    expect(mocks.createMethod).not.toHaveBeenCalled();
  });
});
