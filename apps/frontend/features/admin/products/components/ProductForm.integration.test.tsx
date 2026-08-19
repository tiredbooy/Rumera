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
  listBrands: vi.fn(),
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

// PE-4: the brand picker searches the server instead of filtering a page of 100.
vi.mock("@/features/admin/brands/client", () => ({
  listBrands: mocks.listBrands,
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
import { openProductSection } from "../test-helpers";

// The stock adjustment posts through a "use server" action; Next breaks that
// import chain at the boundary, Vitest needs it stubbed (PE-11).
vi.mock("@/features/inventory/actions", () => ({
  adjustVariantStockAction: vi.fn(),
  updateVariantReorderAction: vi.fn(),
}));

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
    slug: "rumera",
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
  mocks.listBrands.mockResolvedValue({
    results: brands,
    pagination: { page: 1, limit: 20, total: brands.length, has_next: false },
  });
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

/**
 * Radix hands focus back to a closing popover's trigger a tick after it goes,
 * which dismisses a picker opened in that same tick — a race only a test is
 * fast enough to lose. Re-open and re-pick until the choice sticks.
 */
async function chooseOption(label: string, option: string) {
  const trigger = screen.getByRole("combobox", { name: label });
  const before = trigger.textContent ?? "";
  await waitFor(() => {
    if (trigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(trigger);
    }
    fireEvent.click(screen.getByRole("option", { name: option }));
    expect(trigger.textContent).not.toBe(before);
  });
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

    openProductSection("specs");
    fireEvent.change(screen.getByLabelText("درصد الکل"), {
      target: { value: "14.5" },
    });
    fireEvent.change(screen.getByLabelText(/وزن/), {
      target: { value: "750" },
    });

    openProductSection("tags");
    fireEvent.click(screen.getByRole("button", { name: "هدیه" }));

    openProductSection("variants");
    fireEvent.click(screen.getByRole("button", { name: /ساخت گروهی تنوع‌ها/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /رنگ/ }));
    fireEvent.change(screen.getByLabelText("قیمت پایه (تومان)"), {
      target: { value: "125000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /پیش‌نمایش ۲ ترکیب/ }));
    fireEvent.click(screen.getByRole("button", { name: /ساخت ۲ تنوع/ }));

    openProductSection("images");
    fireEvent.change(screen.getByLabelText("نشانی تصویر محصول"), {
      target: { value: "https://images.example/new-product.webp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "افزودن نشانی" }));

    openProductSection("seo");
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
          // Bulk-generated rows arrive already named from the product code and
          // the option value, so nothing is left undifferentiated (PE-1).
          expect.objectContaining({
            sku: "NEW-77-V11",
            price: 125000,
            option_value_ids: [11],
          }),
          expect.objectContaining({
            sku: "NEW-77-V12",
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
    expect(mocks.replace).toHaveBeenCalledWith("/admin/products/77");
    expect(mocks.push).not.toHaveBeenCalledWith("/admin/products");
  }, 15_000);

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

    openProductSection("specs");
    fireEvent.change(screen.getByLabelText("درصد الکل"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/وزن/), { target: { value: "" } });
    openProductSection("tags");
    fireEvent.click(screen.getByRole("button", { name: "هدیه" }));
    openProductSection("variants");
    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع 1" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف تنوع" }));
    openProductSection("images");
    fireEvent.click(screen.getByRole("button", { name: "حذف تصویر 1" }));

    openProductSection("seo");
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
    expect(mocks.push).not.toHaveBeenCalledWith("/admin/products");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  // PE-6: validate on blur so a long form does not save its verdict for submit,
  // but stay quiet while the operator is still typing into the field.
  it("flags a field on blur without nagging mid-typing or opening the summary", async () => {
    render(
      <ProductForm
        mode="create"
        categories={categories}
        optionTypes={optionTypes}
      />,
    );

    const title = screen.getByLabelText("نام محصول");
    fireEvent.change(title, { target: { value: "الف" } });
    fireEvent.change(title, { target: { value: "" } });
    expect(screen.queryByText("نام محصول الزامی است")).not.toBeInTheDocument();

    fireEvent.blur(title);

    expect(await screen.findByText("نام محصول الزامی است")).toBeInTheDocument();
    expect(
      screen.queryByText(/مورد باید پیش از ذخیره اصلاح شود/),
    ).not.toBeInTheDocument();
  });

  // PE-6: the variant grid marks a bad cell inline, which is invisible when the
  // row is one of dozens. The summary has to say which row and which column.
  it("names every failing variant cell and jumps into the grid", async () => {
    window.history.replaceState(null, "", "/admin/products/42");
    render(
      <ProductForm
        mode="edit"
        product={existingProduct}
        categories={categories}
        optionTypes={optionTypes}
      />,
    );

    fireEvent.change(screen.getByLabelText("نام محصول"), {
      target: { value: "" },
    });
    openProductSection("variants");
    fireEvent.change(screen.getByLabelText("قیمت تنوع 1 به تومان"), {
      target: { value: "" },
    });
    // Submitting from the variants section: the summary sits above the
    // sections, so it is reachable whichever one is open (PE-5 × PE-6).
    clickSave();

    const priceLink = await screen.findByRole("link", {
      name: "تنوع 1 — قیمت: قیمت معتبر وارد کنید",
    });
    expect(
      screen.getByRole("link", { name: "نام محصول: نام محصول الزامی است" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("۲ مورد باید پیش از ذخیره اصلاح شود"),
    ).toBeInTheDocument();
    expect(mocks.saveProductAggregate).not.toHaveBeenCalled();

    fireEvent.click(priceLink);
    await waitFor(() =>
      expect(screen.getByLabelText("قیمت تنوع 1 به تومان")).toHaveFocus(),
    );

    fireEvent.change(screen.getByLabelText("قیمت تنوع 1 به تومان"), {
      target: { value: "250000" },
    });
    await waitFor(() =>
      expect(
        screen.getByText("۱ مورد باید پیش از ذخیره اصلاح شود"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: /تنوع 1 — قیمت/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps brand, category, and tag lookups when the option catalog failed", async () => {
    render(
      <ProductForm
        mode="create"
        categories={categories}
        tags={[
          {
            id: 9,
            title: "هدیه",
            slug: "gift",
            created_at: "2026-07-27T00:00:00Z",
            updated_at: "2026-07-27T00:00:00Z",
          },
        ]}
        optionTypes={[]}
        optionCatalogError="بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید."
      />,
    );

    await chooseOption("دسته‌بندی", "نوشیدنی ویژه");
    await chooseOption("برند / سازنده", "رومرا");
    openProductSection("tags");
    expect(screen.getByRole("button", { name: "هدیه" })).toBeInTheDocument();

    openProductSection("variants");
    expect(
      screen.getByText("هنوز ویژگی مشترکی تعریف نشده"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
