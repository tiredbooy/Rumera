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

vi.mock("@/features/admin/tags/api", () => ({
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
import { openProductSection } from "../test-helpers";

const product = {
  id: 42,
  title: "محصول",
  slug: "mahsool",
  is_active: true,
  updated_at: "2026-07-26T12:00:00Z",
  tags: [{ id: 1, title: "قدیمی" }],
  variants: [],
  images: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveProductAggregate.mockResolvedValue(product);
});

describe("ProductForm tag integration", () => {
  it("submits selected tags with the product create", async () => {
    render(<ProductForm mode="create" categories={[]} />);

    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول تازه" },
    });
    openProductSection("tags");
    fireEvent.click(screen.getByRole("button", { name: "تازه" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ title: "محصول تازه", tag_ids: [2] }),
    );
  });

  it("submits selected tags with the product update", async () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    openProductSection("tags");
    expect(screen.getByRole("button", { name: "قدیمی" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "تازه" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ tag_ids: [1, 2] }),
    );
  });

  it("submits an intentional empty tag selection", async () => {
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    openProductSection("tags");
    fireEvent.click(screen.getByRole("button", { name: "قدیمی" }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ tag_ids: [] }),
    );
  });

  it("reports product update failures", async () => {
    mocks.saveProductAggregate.mockRejectedValueOnce(new Error("شبکه قطع است"));
    render(<ProductForm mode="edit" product={product} categories={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "ذخیره محصول" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("شبکه قطع است");
  });
});
