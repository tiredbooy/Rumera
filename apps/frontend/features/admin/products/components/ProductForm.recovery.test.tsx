// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { UseFormRegister } from "react-hook-form";
import type { Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductFormValues } from "../validations";

const mocks = vi.hoisted(() => ({
  saveProductAggregate: vi.fn(),
  prepare: vi.fn(),
  preservePrepared: vi.fn(),
  commit: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/products/api/client", () => ({
  ProductClientError: class ProductClientError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
      public readonly fields?: Record<string, string[]>,
    ) {
      super(message);
    }
  },
  saveProductAggregate: mocks.saveProductAggregate,
}));

vi.mock("./product-form/sidebar/FormHeaderBar", () => ({
  FormHeaderBar: ({ hasPendingRetry }: { hasPendingRetry: boolean }) => (
    <button type="submit">
      {hasPendingRetry ? "تلاش دوباره" : "ذخیره محصول"}
    </button>
  ),
}));
vi.mock("./product-form/sidebar/MobileActionBar", () => ({
  MobileActionBar: () => null,
}));
vi.mock("./product-form/sidebar/PreviewCard", () => ({
  PreviewCard: () => null,
}));
vi.mock("./product-form/GeneralInfoSection", () => ({
  GeneralInfoSection: ({
    register,
  }: {
    register: UseFormRegister<ProductFormValues>;
  }) => <input aria-label="نام محصول" {...register("title")} />,
}));
vi.mock("./product-form/SpecificationsSection", () => ({
  SpecificationsSection: () => null,
}));
vi.mock("./product-form/VariantsSection", () => ({
  VariantsSection: () => null,
}));
vi.mock("./product-form/ImagesSection", async () => {
  const React = await import("react");
  return {
    ImagesSection: ({ uploaderRef }: { uploaderRef: Ref<unknown> }) => {
      React.useImperativeHandle(uploaderRef, () => ({
        hasStaged: true,
        isBusy: false,
        validate: () => null,
        flush: async () => undefined,
        prepare: mocks.prepare,
        preservePrepared: mocks.preservePrepared,
        commit: mocks.commit,
      }));
      return null;
    },
  };
});
vi.mock("./product-form/SeoSection", () => ({
  SeoSection: () => null,
}));
vi.mock("./product-form/TagsSection", () => ({
  TagsSection: () => null,
}));

import { ProductClientError } from "@/features/admin/products/api/client";
import { ProductForm } from "./ProductForm";

const savedProduct = {
  id: 77,
  title: "Recovered product",
  is_active: true,
  updated_at: "2026-07-26T15:00:00Z",
  tags: [],
  variants: [],
  images: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockResolvedValue([]);
  sessionStorage.clear();
});

describe("ProductForm aggregate recovery", () => {
  it("persists and replays the immutable request after an ambiguous reload", async () => {
    mocks.saveProductAggregate
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(savedProduct);
    const firstRender = render(
      <ProductForm mode="create" categories={[]} brands={[]} />,
    );
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "Recovered product" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    await screen.findByRole("button", { name: "تلاش دوباره" });
    const firstPayload = mocks.saveProductAggregate.mock.calls[0]?.[1];
    expect(firstPayload.operation_id).toEqual(expect.any(String));
    expect(mocks.preservePrepared).toHaveBeenLastCalledWith(true);
    expect(
      sessionStorage.getItem("rumera:product-aggregate:create:new"),
    ).not.toBeNull();

    firstRender.unmount();
    render(<ProductForm mode="create" categories={[]} brands={[]} />);
    const retry = await screen.findByRole("button", { name: "تلاش دوباره" });
    expect(screen.getByLabelText("نام محصول")).toBeDisabled();
    fireEvent.click(retry);

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(2),
    );
    expect(mocks.saveProductAggregate.mock.calls[1]?.[1]).toEqual(firstPayload);
    await waitFor(() =>
      expect(
        sessionStorage.getItem("rumera:product-aggregate:create:new"),
      ).toBeNull(),
    );
    expect(mocks.push).toHaveBeenCalledWith("/admin/products/77");
  });

  it("unfreezes a definitively rejected request for correction", async () => {
    mocks.saveProductAggregate.mockRejectedValueOnce(
      new ProductClientError(422, "VALIDATION_ERROR", "validation failed", {
        title: ["invalid title"],
      }),
    );
    render(<ProductForm mode="create" categories={[]} brands={[]} />);
    const title = screen.getByLabelText("نام محصول");
    fireEvent.change(title, { target: { value: "Rejected product" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await screen.findByText("invalid title");
    expect(mocks.preservePrepared).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(title).not.toBeDisabled());
    await waitFor(() =>
      expect(
        sessionStorage.getItem("rumera:product-aggregate:create:new"),
      ).toBeNull(),
    );
  });
});
