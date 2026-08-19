import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchLookupList: vi.fn(),
  listCategories: vi.fn(),
  getBrand: vi.fn(),
  loadProductOptionCatalog: vi.fn(),
  getProductForAdmin: vi.fn(),
  getVariantInventory: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    constructor(public readonly status: number) {
      super();
    }
  },
}));
vi.mock("@/features/admin/shared/fetch-lookup-list", () => ({
  fetchLookupList: mocks.fetchLookupList,
}));
vi.mock("@/features/catalog/categories/api", () => ({
  listCategories: mocks.listCategories,
}));
vi.mock("@/features/catalog/brands/api", () => ({
  getBrand: mocks.getBrand,
}));
vi.mock("@/features/inventory/api", () => ({
  getVariantInventory: mocks.getVariantInventory,
}));
vi.mock("@/features/admin/products/api/server", () => ({
  getProductForAdmin: mocks.getProductForAdmin,
  loadProductOptionCatalog: mocks.loadProductOptionCatalog,
}));
vi.mock("@/features/dashboard/components/page-header", () => ({
  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),
}));
vi.mock("./ProductForm", () => ({
  ProductForm: ({
    categories,
    selectedBrand,
    tags,
    optionTypes,
    optionCatalogError,
    canWrite,
    canAdjustStock,
    product,
    inventory,
  }: {
    categories: Array<{ title: string }>;
    selectedBrand?: { title: string } | null;
    tags: Array<{ title: string }>;
    optionTypes: Array<{ display_name: string }>;
    optionCatalogError?: string | null;
    canWrite?: boolean;
    canAdjustStock?: boolean;
    product?: { title: string };
    inventory?: Array<{ product_variant_id: number }>;
  }) => (
    <div>
      {product ? <p>{product.title}</p> : null}
      <p>{categories.map((item) => item.title).join(",")}</p>
      {selectedBrand ? <p>{selectedBrand.title}</p> : null}
      <p>{tags.map((item) => item.title).join(",")}</p>
      <p>{optionTypes.map((item) => item.display_name).join(",")}</p>
      {optionCatalogError ? <p>{optionCatalogError}</p> : null}
      <p>{canWrite ? "writable" : "readonly"}</p>
      <p>{canAdjustStock ? "stock-writable" : "stock-locked"}</p>
      <p>inventory-{inventory?.length ?? 0}</p>
    </div>
  ),
}));

import { ProductCreateView, ProductEditView } from "./product-editor-view";

const CATALOG_ERROR = "بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید.";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchLookupList.mockImplementation(async (path: string) => {
    if (path.startsWith("/tags")) return [{ id: 9, title: "هدیه" }];
    return [];
  });
  mocks.listCategories.mockResolvedValue([{ id: 3, title: "نوشیدنی ویژه" }]);
  mocks.getBrand.mockResolvedValue({ id: 101, title: "رومرا" });
  mocks.loadProductOptionCatalog.mockResolvedValue({
    optionTypes: [],
    error: CATALOG_ERROR,
  });
});

describe("product editor option catalog isolation", () => {
  it("keeps brand/category/tag lookups when the option catalog fails", async () => {
    const html = renderToStaticMarkup(await ProductCreateView());

    expect(html).toContain("نوشیدنی ویژه");
    expect(html).toContain("هدیه");
    expect(html).toContain(CATALOG_ERROR);
    expect(html).toContain("writable");
    expect(mocks.fetchLookupList).toHaveBeenCalledTimes(1);
    expect(mocks.listCategories).toHaveBeenCalledOnce();
  });

  // PE-4: brand #101 sits outside page one of /brands. The editor must name it
  // from a by-id read, not report «no brand» over a product that has one.
  it("labels a brand that no list page would have contained", async () => {
    mocks.getProductForAdmin.mockResolvedValue({
      id: 42,
      title: "محصول موجود",
      brand_id: 101,
    });

    const html = renderToStaticMarkup(
      await ProductEditView({ id: "42", canWrite: true }),
    );

    expect(mocks.getBrand).toHaveBeenCalledWith(101);
    expect(html).toContain("رومرا");
  });

  it("leaves the brand unseeded when the by-id read fails", async () => {
    mocks.getProductForAdmin.mockResolvedValue({
      id: 42,
      title: "محصول موجود",
      brand_id: 101,
    });
    mocks.getBrand.mockRejectedValue(new Error("gone"));

    const html = renderToStaticMarkup(
      await ProductEditView({ id: "42", canWrite: true }),
    );

    expect(html).toContain("محصول موجود");
    expect(html).not.toContain("رومرا");
  });

  it("seeds create from an existing product and clears identity", async () => {
    mocks.getProductForAdmin.mockResolvedValue({
      id: 12,
      title: "ویسکی منبع",
      slug: "source",
      variants: [
        { id: 3, sku: "SRC", price: 10, is_active: true, options: [] },
      ],
    });

    const html = renderToStaticMarkup(
      await ProductCreateView({ fromId: "12" }),
    );

    expect(html).toContain("تکثیر محصول");
    expect(html).toContain("ویسکی منبع");
    expect(mocks.getProductForAdmin).toHaveBeenCalledWith(12);
  });

  it("does not drop the loaded product when the option catalog fails", async () => {
    mocks.getProductForAdmin.mockResolvedValue({
      id: 42,
      title: "محصول موجود",
    });

    const html = renderToStaticMarkup(
      await ProductEditView({ id: "42", canWrite: false }),
    );

    expect(html).toContain("محصول موجود");
    expect(html).toContain("نوشیدنی ویژه");
    expect(html).toContain(CATALOG_ERROR);
    expect(html).toContain("readonly");
  });

  it("loads stock for every variant instead of dropping the lot above 24", async () => {
    const variants = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
    }));
    mocks.getProductForAdmin.mockResolvedValue({
      id: 42,
      title: "محصول موجود",
      variants,
    });
    mocks.getVariantInventory.mockImplementation(async (id: number) => ({
      id,
      product_variant_id: id,
    }));

    const html = renderToStaticMarkup(
      await ProductEditView({
        id: "42",
        canWrite: true,
        canAdjustStock: true,
      }),
    );

    expect(mocks.getVariantInventory).toHaveBeenCalledTimes(30);
    expect(html).toContain("inventory-30");
    expect(html).toContain("stock-writable");
  });
});
