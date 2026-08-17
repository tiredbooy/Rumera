import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCategory: vi.fn(),
  getCategoryTree: vi.fn(),
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
vi.mock("@/features/admin/categories/api", () => ({
  getCategory: mocks.getCategory,
  getCategoryTree: mocks.getCategoryTree,
}));
vi.mock("@/features/dashboard/components/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("./CategoryForm", () => ({
  CategoryForm: ({
    canWrite,
    category,
  }: {
    canWrite?: boolean;
    category?: { title: string };
  }) => (
    <div>
      {category ? <p>{category.title}</p> : null}
      <p>{canWrite ? "writable" : "readonly"}</p>
    </div>
  ),
}));

import { CategoryCreateView, CategoryEditView } from "./category-editor-view";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCategoryTree.mockResolvedValue([]);
});

describe("category editor write gate", () => {
  it("create always passes canWrite", async () => {
    const html = renderToStaticMarkup(await CategoryCreateView());
    expect(html).toContain("writable");
  });

  it("edit forwards a read-only canWrite flag", async () => {
    mocks.getCategory.mockResolvedValue({ id: 11, title: "ویسکی" });

    const html = renderToStaticMarkup(
      await CategoryEditView({ id: "11", canWrite: false }),
    );

    expect(html).toContain("ویسکی");
    expect(html).toContain("readonly");
  });
});
