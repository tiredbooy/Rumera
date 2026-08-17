// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminProductDetail } from "@/features/admin/products/types";
import type { ProductFormValues } from "../validations";

const mocks = vi.hoisted(() => ({
  saveProductAggregate: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/products/api/client", () => ({
  ProductClientError: class ProductClientError extends Error {},
  saveProductAggregate: mocks.saveProductAggregate,
}));

vi.mock("./product-form/sidebar/FormHeaderBar", () => ({
  FormHeaderBar: () => <button type="submit">ذخیره محصول</button>,
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
vi.mock("./product-form/ImagesSection", () => ({
  ImagesSection: () => null,
}));
vi.mock("./product-form/SeoSection", () => ({
  SeoSection: () => null,
}));
vi.mock("./product-form/TagsSection", () => ({
  TagsSection: () => null,
}));
vi.mock("./product-form/VariantsSection", () => ({
  VariantsSection: ({
    setValue,
  }: {
    setValue: UseFormSetValue<ProductFormValues>;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          setValue(
            "variants",
            [
              {
                _id: 11,
                sku: "RED",
                price: "100",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [202],
              },
              {
                _id: 12,
                sku: "BLUE",
                price: "110",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [201],
              },
            ],
            { shouldDirty: true, shouldValidate: true },
          )
        }
      >
        جابه‌جایی ویژگی‌ها
      </button>
      <button
        type="button"
        onClick={() =>
          setValue(
            "variants",
            [
              {
                _id: 11,
                sku: "BLUE",
                price: "100",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [201],
              },
              {
                _id: 12,
                sku: "RED",
                price: "110",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [202],
              },
            ],
            { shouldDirty: true, shouldValidate: true },
          )
        }
      >
        جابه‌جایی SKU
      </button>
      <button
        type="button"
        onClick={() =>
          setValue(
            "variants",
            [
              {
                sku: "NEW",
                price: "120",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [],
              },
            ],
            { shouldDirty: true, shouldValidate: true },
          )
        }
      >
        افزودن تنوع تازه
      </button>
    </>
  ),
}));

import { ProductForm } from "./ProductForm";

const product: AdminProductDetail = {
  id: 42,
  title: "محصول",
  is_active: true,
  updated_at: "2026-07-26T12:00:00Z",
  images: [],
  tags: [],
  variants: [
    {
      id: 11,
      sku: "RED",
      price: 100,
      is_active: true,
      images: [],
      options: [
        {
          id: 201,
          option_type_id: 7,
          option_type_title: "color",
          option_type: "رنگ",
          value: "قرمز",
        },
      ],
    },
    {
      id: 12,
      sku: "BLUE",
      price: 110,
      is_active: true,
      images: [],
      options: [
        {
          id: 202,
          option_type_id: 7,
          option_type_title: "color",
          option_type: "رنگ",
          value: "آبی",
        },
      ],
    },
  ],
};

const emptyProduct: AdminProductDetail = {
  id: 43,
  title: "محصول خالی",
  is_active: true,
  updated_at: "2026-07-26T12:00:00Z",
  images: [],
  tags: [],
  variants: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveProductAggregate.mockResolvedValue(product);
});

describe("ProductForm variant option persistence", () => {
  it("sends exchanged combinations in one aggregate request", async () => {
    render(
      <ProductForm mode="edit" product={product} categories={[]} brands={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "جابه‌جایی ویژگی‌ها" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate.mock.calls[0]?.[0]).toBe(42);
    expect(mocks.saveProductAggregate.mock.calls[0]?.[1].variants).toEqual([
      expect.objectContaining({ id: 11, option_value_ids: [202] }),
      expect.objectContaining({ id: 12, option_value_ids: [201] }),
    ]);
  });

  it("sends a valid SKU exchange without intermediate clearing writes", async () => {
    render(
      <ProductForm mode="edit" product={product} categories={[]} brands={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "جابه‌جایی SKU" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate.mock.calls[0]?.[1].variants).toEqual([
      expect.objectContaining({ id: 11, sku: "BLUE" }),
      expect.objectContaining({ id: 12, sku: "RED" }),
    ]);
  });

  it("resets to committed variant IDs for the next aggregate save", async () => {
    const savedWithVariant: AdminProductDetail = {
      ...emptyProduct,
      updated_at: "2026-07-26T12:05:00Z",
      variants: [
        {
          id: 13,
          sku: "NEW",
          price: 120,
          is_active: true,
          options: [],
          images: [],
        },
      ],
    };
    mocks.saveProductAggregate.mockResolvedValue(savedWithVariant);
    render(
      <ProductForm
        mode="edit"
        product={emptyProduct}
        categories={[]}
        brands={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "افزودن تنوع تازه" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));
    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));
    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(2),
    );
    expect(mocks.saveProductAggregate.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        expected_updated_at: "2026-07-26T12:05:00Z",
        variants: [expect.objectContaining({ id: 13, sku: "NEW" })],
      }),
    );
  });
});
