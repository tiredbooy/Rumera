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

import type {
  AdminProductDetail,
  ProductOptionGroup,
} from "@/features/admin/products/types";
import type { Brand } from "@/features/catalog/brands/types";
import type { Category } from "@/features/catalog/categories/types";

const mocks = vi.hoisted(() => ({
  saveProductAggregate: vi.fn(),
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
  ProductClientError: class ProductClientError extends Error {},
  saveProductAggregate: mocks.saveProductAggregate,
  addProductImageURL: vi.fn(),
  uploadProductImage: vi.fn(),
}));

vi.mock("@/features/admin/products/actions/images", () => ({
  deleteProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
  setPrimaryImage: vi.fn(),
  updateImageAlt: vi.fn(),
}));

vi.mock("@/features/image-uploader/client", () => ({
  uploadImage: vi.fn(),
  releaseUpload: vi.fn(),
}));

vi.mock("@/features/admin/tags/api", () => ({
  useAllTags: () => ({
    data: [
      {
        id: 9,
        title: "هدیه",
        slug: "gift",
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:00Z",
      },
    ],
    isPending: false,
    isError: false,
    isSuccess: true,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

import { ProductForm } from "./ProductForm";

const categories: Category[] = [
  {
    id: 3,
    title: "نوشیدنی ویژه",
    is_featured: false,
    display_order: 1,
  },
];

const brands: Brand[] = [
  {
    id: 4,
    title: "رومرا",
    created_at: "2026-07-27T00:00:00Z",
    updated_at: "2026-07-27T00:00:00Z",
  },
];

const optionTypes: ProductOptionGroup[] = [
  {
    id: 7,
    title: "color",
    display_name: "رنگ",
    created_at: "2026-07-27T00:00:00Z",
    updated_at: "2026-07-27T00:00:00Z",
    values: [
      {
        id: 11,
        option_type_id: 7,
        value: "قرمز",
        sort_order: 0,
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:00Z",
      },
      {
        id: 12,
        option_type_id: 7,
        value: "آبی",
        sort_order: 1,
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:00Z",
      },
    ],
  },
];

const existingProduct: AdminProductDetail = {
  id: 42,
  title: "محصول موجود",
  code: "OLD-42",
  slug: "existing-product",
  category_id: 3,
  description: "توضیح قدیمی",
  brand_id: 4,
  country_of_origin: "ایران",
  abv: 12.5,
  weight: 750,
  is_active: true,
  meta_title: "عنوان قدیمی",
  meta_description: "توضیح سئوی قدیمی",
  meta_tags: ["قدیمی"],
  updated_at: "2026-07-27T08:00:00Z",
  tags: [{ id: 9, title: "هدیه" }],
  variants: [
    {
      id: 81,
      sku: "OLD-RED",
      price: 200_000,
      compare_at_price: 220_000,
      is_active: true,
      available_stock: 0,
      options: [
        {
          id: 11,
          option_type_id: 7,
          option_type_title: "color",
          option_type: "رنگ",
          value: "قرمز",
        },
      ],
      images: [],
    },
  ],
  images: [
    {
      id: 91,
      image_url: "/media/products/42/cover.webp",
      storage_key: "products/42/cover.webp",
      alt_text: "تصویر قدیمی",
      sort_order: 0,
      is_primary: true,
    },
  ],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/admin/products/new");
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
});

async function chooseOption(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

function clickSave() {
  fireEvent.click(screen.getAllByRole("button", { name: "ذخیره" })[0]);
}

describe("ProductForm complete authoring journeys", () => {
  it("creates a draft with merchandising fields, tags, gallery, and generated variants", async () => {
    const saved: AdminProductDetail = {
      id: 77,
      title: "محصول تازه",
      is_active: false,
      updated_at: "2026-07-27T09:00:00Z",
      tags: [{ id: 9, title: "هدیه" }],
      variants: [],
      images: [],
    };
    mocks.saveProductAggregate.mockResolvedValue(saved);
    render(
      <ProductForm
        mode="create"
        categories={categories}
        brands={brands}
        optionTypes={optionTypes}
      />,
    );

    expect(screen.getAllByText("پیش‌نویس").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "محصول تازه" },
    });
    fireEvent.change(screen.getByLabelText("نامک (انگلیسی)"), {
      target: { value: "new-product" },
    });
    fireEvent.change(screen.getByLabelText("کد محصول (SKU پایه)"), {
      target: { value: "NEW-77" },
    });
    await chooseOption("دسته‌بندی", "نوشیدنی ویژه");
    await chooseOption("برند / سازنده", "رومرا");
    fireEvent.change(screen.getByLabelText("کشور سازنده"), {
      target: { value: "ایران" },
    });
    fireEvent.change(screen.getByLabelText("توضیحات"), {
      target: { value: "توضیح کامل محصول" },
    });

    fireEvent.click(screen.getByRole("button", { name: /مشخصات/ }));
    fireEvent.change(screen.getByLabelText("درصد الکل"), {
      target: { value: "14.5" },
    });
    fireEvent.change(screen.getByLabelText("وزن"), {
      target: { value: "750" },
    });

    fireEvent.click(screen.getByRole("button", { name: /برچسب‌های فروشگاهی/ }));
    fireEvent.click(screen.getByRole("button", { name: "هدیه" }));

    fireEvent.click(screen.getByRole("button", { name: /ساخت گروهی تنوع‌ها/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /رنگ/ }));
    fireEvent.change(screen.getByLabelText("قیمت پایه (تومان)"), {
      target: { value: "125000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ساخت ۲ ترکیب/ }));

    fireEvent.click(screen.getByRole("button", { name: /تصاویر محصول/ }));
    fireEvent.change(screen.getByLabelText("نشانی تصویر محصول"), {
      target: { value: "https://images.example/new-product.webp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "افزودن نشانی" }));

    fireEvent.click(screen.getByRole("button", { name: /سئو و متادیتا/ }));
    fireEvent.change(screen.getByLabelText("عنوان سئو"), {
      target: { value: "عنوان محصول تازه" },
    });
    fireEvent.change(screen.getByLabelText("توضیحات سئو"), {
      target: { value: "توضیح مناسب موتور جست‌وجو" },
    });
    fireEvent.change(screen.getByLabelText("کلیدواژه‌ها"), {
      target: { value: "تازه، هدیه" },
    });

    clickSave();

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        title: "محصول تازه",
        code: "NEW-77",
        slug: "new-product",
        category_id: 3,
        brand_id: 4,
        description: "توضیح کامل محصول",
        country_of_origin: "ایران",
        abv: 14.5,
        weight: 750,
        is_active: false,
        meta_title: "عنوان محصول تازه",
        meta_description: "توضیح مناسب موتور جست‌وجو",
        meta_tags: ["تازه", "هدیه"],
        tag_ids: [9],
        variants: [
          expect.objectContaining({
            price: 125000,
            option_value_ids: [11],
          }),
          expect.objectContaining({
            price: 125000,
            option_value_ids: [12],
          }),
        ],
        images: [
          {
            image_url: "https://images.example/new-product.webp",
            alt_text: null,
            is_primary: true,
          },
        ],
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/admin/products/77");
  });

  it("edits a product and intentionally clears nullable and aggregate fields", async () => {
    const saved: AdminProductDetail = {
      id: 42,
      title: "محصول موجود",
      is_active: false,
      updated_at: "2026-07-27T09:30:00Z",
      tags: [],
      variants: [],
      images: [],
    };
    mocks.saveProductAggregate.mockResolvedValue(saved);
    window.history.replaceState(null, "", "/admin/products/42");
    render(
      <ProductForm
        mode="edit"
        product={existingProduct}
        categories={categories}
        brands={brands}
        optionTypes={optionTypes}
      />,
    );

    for (const label of [
      "نامک (انگلیسی)",
      "کد محصول (SKU پایه)",
      "کشور سازنده",
      "توضیحات",
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    }
    await chooseOption("دسته‌بندی", "بدون دسته");
    await chooseOption("برند / سازنده", "بدون برند");

    fireEvent.click(screen.getByRole("button", { name: /مشخصات/ }));
    fireEvent.change(screen.getByLabelText("درصد الکل"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("وزن"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "هدیه" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع 1" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف تصویر 1" }));

    fireEvent.click(screen.getByRole("button", { name: /سئو و متادیتا/ }));
    fireEvent.change(screen.getByLabelText("عنوان سئو"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("توضیحات سئو"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("کلیدواژه‌ها"), {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getAllByRole("switch", { name: "وضعیت انتشار محصول" })[0],
    );

    clickSave();

    await waitFor(() =>
      expect(mocks.saveProductAggregate).toHaveBeenCalledTimes(1),
    );
    expect(mocks.saveProductAggregate).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        expected_updated_at: "2026-07-27T08:00:00Z",
        code: null,
        slug: null,
        category_id: null,
        description: null,
        brand_id: null,
        country_of_origin: null,
        abv: null,
        weight: null,
        is_active: false,
        meta_title: null,
        meta_description: null,
        meta_tags: [],
        tag_ids: [],
        variants: [],
        images: [],
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("همهٔ تغییرات ذخیره شد")).toBeInTheDocument(),
    );
  });
});
