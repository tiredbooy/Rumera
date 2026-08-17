import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchLookupList: vi.fn(),
  loadProductOptionCatalog: vi.fn(),
  getProductForAdmin: vi.fn(),
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
    brands,
    tags,
    optionTypes,
    optionCatalogError,
    canWrite,
    product,
  }: {
    categories: Array<{ title: string }>;
    brands: Array<{ title: string }>;
    tags: Array<{ title: string }>;
    optionTypes: Array<{ display_name: string }>;
    optionCatalogError?: string | null;
    canWrite?: boolean;
    product?: { title: string };
  }) => (
    <div>
      {product ? <p>{product.title}</p> : null}
      <p>{categories.map((item) => item.title).join(",")}</p>
      <p>{brands.map((item) => item.title).join(",")}</p>
      <p>{tags.map((item) => item.title).join(",")}</p>
      <p>{optionTypes.map((item) => item.display_name).join(",")}</p>
      {optionCatalogError ? <p>{optionCatalogError}</p> : null}
      <p>{canWrite ? "writable" : "readonly"}</p>
    </div>
  ),
}));

import { ProductCreateView, ProductEditView } from "./product-editor-view";

const CATALOG_ERROR = "بارگذاری ویژگی‌های تنوع ناموفق بود. دوباره تلاش کنید.";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchLookupList.mockImplementation(async (path: string) => {
    if (path.startsWith("/categories")) return [{ id: 3, title: "نوشیدنی ویژه" }];
    if (path.startsWith("/brands")) return [{ id: 4, title: "رومرا" }];
    if (path.startsWith("/tags")) return [{ id: 9, title: "هدیه" }];
    return [];
  });
  mocks.loadProductOptionCatalog.mockResolvedValue({
    optionTypes: [],
    error: CATALOG_ERROR,
  });
});

describe("product editor option catalog isolation", () => {
  it("keeps brand/category/tag lookups when the option catalog fails", async () => {
    const html = renderToStaticMarkup(await ProductCreateView());

    expect(html).toContain("نوشیدنی ویژه");
    expect(html).toContain("رومرا");
    expect(html).toContain("هدیه");
    expect(html).toContain(CATALOG_ERROR);
    expect(html).toContain("writable");
    expect(mocks.fetchLookupList).toHaveBeenCalledTimes(3);
  });

  it("seeds create from an existing product and clears identity", async () => {
    mocks.getProductForAdmin.mockResolvedValue({
      id: 12,
      title: "ویسکی منبع",
      slug: "source",
      variants: [{ id: 3, sku: "SRC", price: 10, is_active: true, options: [] }],
    });

    const html = renderToStaticMarkup(await ProductCreateView({ fromId: "12" }));

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
    expect(html).toContain("رومرا");
    expect(html).toContain(CATALOG_ERROR);
    expect(html).toContain("readonly");
  });
});
