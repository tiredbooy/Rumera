import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminJournalPost: vi.fn(),
  listAdminJournalCategories: vi.fn(),
  listTags: vi.fn(),
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
vi.mock("@/features/admin/products/api/server", () => ({
  getProductForAdmin: vi.fn(),
}));
vi.mock("@/features/catalog/tags/api/public", () => ({
  listTags: mocks.listTags,
}));
vi.mock("@/features/journal/api/admin", () => ({
  getAdminJournalCategory: vi.fn(),
  getAdminJournalPost: mocks.getAdminJournalPost,
  listAdminJournalCategories: mocks.listAdminJournalCategories,
}));
vi.mock("@/features/dashboard/components/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("./journal-category-form", () => ({
  JournalCategoryForm: () => null,
}));
vi.mock("./journal-form", () => ({
  JournalForm: ({
    canWrite,
    post,
  }: {
    canWrite?: boolean;
    post?: { title: string };
  }) => (
    <div>
      {post ? <p>{post.title}</p> : null}
      <p>{canWrite ? "writable" : "readonly"}</p>
    </div>
  ),
}));

import { JournalCreateView, JournalEditView } from "./journal-editor-view";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAdminJournalCategories.mockResolvedValue([]);
  mocks.listTags.mockResolvedValue({
    results: [],
    pagination: { has_next: false },
  });
});

describe("journal editor write gate", () => {
  it("create always passes canWrite", async () => {
    const html = renderToStaticMarkup(await JournalCreateView());
    expect(html).toContain("writable");
  });

  it("edit forwards a read-only canWrite flag", async () => {
    mocks.getAdminJournalPost.mockResolvedValue({
      id: 11,
      title: "راهنمای انتخاب",
      product_ids: [],
    });

    const html = renderToStaticMarkup(
      await JournalEditView({ id: 11, canWrite: false }),
    );

    expect(html).toContain("راهنمای انتخاب");
    expect(html).toContain("readonly");
  });
});
