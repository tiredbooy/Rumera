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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductFormValues } from "../validations";

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  syncTags: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/admin/products/actions/product", () => ({
  createProduct: mocks.createProduct,
  updateProduct: mocks.updateProduct,
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
}));

vi.mock("@/features/admin/tags/api", () => ({
  syncProductTags: mocks.syncTags,
  useAllTags: () => ({
    data: [
      {
        id: 1,
        title: "قدیمی",
        slug: "old",
        created_at: "2026-07-18T00:00:00Z",
        updated_at: "2026-07-18T00:00:00Z",
      },
      {
        id: 2,
        title: "تازه",
        slug: "new",
        created_at: "2026-07-19T00:00:00Z",
        updated_at: "2026-07-19T00:00:00Z",
      },
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    refetch: vi.fn(),
  }),
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
vi.mock("./product-form/VariantsSection", () => ({
  VariantsSection: () => null,
}));
vi.mock("./product-form/ImagesSection", () => ({
  ImagesSection: () => null,
}));

import { ProductForm } from "./ProductForm";

const product = {
  id: 42,
  title: "محصول",
  is_active: true,
  tags: [{ id: 1, title: "قدیمی" }],
  variants: [],
  images: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createProduct.mockResolvedValue({ id: 84 });
  mocks.updateProduct.mockResolvedValue(product);
  mocks.syncTags.mockResolvedValue(undefined);
});

describe("ProductForm tag integration", () => {
  it("syncs selected tags after creating the product", async () => {
    render(<ProductForm mode="create" categories={[]} brands={[]} />);

    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول تازه" },
    });
    fireEvent.click(screen.getByRole("button", { name: "تازه" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() => expect(mocks.syncTags).toHaveBeenCalledTimes(1));
    expect(mocks.createProduct.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ title: "محصول تازه", tag_ids: [2] }),
    );
    expect(mocks.syncTags).toHaveBeenCalledWith(84, { tag_ids: [2] });
    expect(mocks.createProduct.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncTags.mock.invocationCallOrder[0],
    );
  });

  it("persists selected IDs through the supported tag sync", async () => {
    render(
      <ProductForm mode="edit" product={product} categories={[]} brands={[]} />,
    );

    expect(screen.getByRole("button", { name: "قدیمی" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "تازه" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() => expect(mocks.syncTags).toHaveBeenCalledTimes(1));
    expect(mocks.updateProduct.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ tag_ids: [1, 2] }),
    );
    expect(mocks.syncTags).toHaveBeenCalledWith(42, { tag_ids: [1, 2] });
    expect(mocks.updateProduct.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncTags.mock.invocationCallOrder[0],
    );
  });

  it("submits an intentional empty tag selection", async () => {
    render(
      <ProductForm mode="edit" product={product} categories={[]} brands={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "قدیمی" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() => expect(mocks.syncTags).toHaveBeenCalledTimes(1));
    expect(mocks.updateProduct.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ tag_ids: [] }),
    );
    expect(mocks.syncTags).toHaveBeenCalledWith(42, { tag_ids: [] });
  });

  it("reports which later product changes remain unsaved after tag failure", async () => {
    mocks.syncTags.mockRejectedValue(new Error("شبکه قطع است"));
    render(
      <ProductForm mode="edit" product={product} categories={[]} brands={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "اطلاعات پایهٔ محصول ذخیره شد، اما برچسب‌ها، گونه‌ها و تصاویر ذخیره نشدند: شبکه قطع است",
    );
  });
});
