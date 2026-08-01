import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ view: vi.fn(() => null) }));

vi.mock("@/features/recipes/components/recipe-list-view", () => ({
  RecipeListView: mocks.view,
}));

import RecipesPage, { generateMetadata } from "./page";

describe("recipe list route", () => {
  it("forwards the promised Next 16 search params", () => {
    const searchParams = Promise.resolve({ difficulty: ["easy", "hard"] });
    const element = RecipesPage({ searchParams });
    expect(element.props.searchParams).toBe(searchParams);
  });

  it("self-canonicalizes clean paginated pages", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ page: "2" }),
    });
    expect(String(metadata.title)).toContain("صفحهٔ ۲");
    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/recipes?page=2",
    );
    expect(metadata.robots).toBeUndefined();
  });

  it("noindexes filter, sort, search, and malformed variants", async () => {
    for (const searchParams of [
      { q: "موخیتو" },
      { difficulty: "easy" },
      { sort: "quick", page: "2" },
      { difficulty: ["easy", "hard"] },
    ]) {
      const metadata = await generateMetadata({
        searchParams: Promise.resolve(searchParams),
      });
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
      expect(metadata.alternates?.canonical).toBe(
        "http://localhost:3000/recipes",
      );
    }
  });
});
