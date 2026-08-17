import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchLookupList: vi.fn(),
  getAdminRecipe: vi.fn(),
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
vi.mock("@/features/recipes/api/server", () => ({
  getAdminRecipe: mocks.getAdminRecipe,
}));
vi.mock("@/features/dashboard/components/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("./RecipeForm", () => ({
  RecipeForm: ({
    canWrite,
    recipe,
  }: {
    canWrite?: boolean;
    recipe?: { title: string };
  }) => (
    <div>
      {recipe ? <p>{recipe.title}</p> : null}
      <p>{canWrite ? "writable" : "readonly"}</p>
    </div>
  ),
}));

import { RecipeCreateView, RecipeEditView } from "./recipe-editor-view";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchLookupList.mockResolvedValue([]);
});

describe("recipe editor write gate", () => {
  it("create always passes canWrite", async () => {
    const html = renderToStaticMarkup(await RecipeCreateView());
    expect(html).toContain("writable");
  });

  it("edit forwards a read-only canWrite flag", async () => {
    mocks.getAdminRecipe.mockResolvedValue({ id: 7, title: "نگroni" });

    const html = renderToStaticMarkup(
      await RecipeEditView({ id: "7", canWrite: false }),
    );

    expect(html).toContain("نگroni");
    expect(html).toContain("readonly");
  });
});
