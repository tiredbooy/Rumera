// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  zone: vi.fn(),
  method: vi.fn(),
}));

vi.mock("@/features/shipping/api", () => {
  class ShippingApiError extends Error {
    status = 500;
  }
  return {
    ShippingApiError,
    useAdminShippingZone: () => mocks.zone(),
    useAdminShippingMethod: () => mocks.method(),
  };
});

vi.mock("@/features/dashboard/components/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("./shipping-method-form", () => ({
  ShippingMethodForm: () => <div>method form</div>,
}));

import { ShippingMethodEditView } from "./shipping-editor-views";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.zone.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { id: 3, name: "Tehran" },
    refetch: vi.fn(),
  });
});

describe("ShippingMethodEditView", () => {
  it("refuses to edit a method from a different zone", () => {
    mocks.method.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 8,
        shipping_zone_id: 4,
        name: "Foreign method",
      },
      refetch: vi.fn(),
    });

    render(<ShippingMethodEditView zoneID={3} methodID={8} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "روش ارسال متعلق به این منطقه نیست",
    );
    expect(screen.queryByText("method form")).not.toBeInTheDocument();
  });

  it("renders the editor when the nested relationship matches", () => {
    mocks.method.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 8,
        shipping_zone_id: 3,
        name: "Local method",
      },
      refetch: vi.fn(),
    });

    render(<ShippingMethodEditView zoneID={3} methodID={8} />);

    expect(screen.getByText("method form")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
