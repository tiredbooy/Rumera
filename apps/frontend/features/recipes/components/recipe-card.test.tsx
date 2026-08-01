import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RecipeListItem } from "@/features/recipes/types";
import { RecipeCard } from "./recipe-card";

const recipe: RecipeListItem = {
  id: 4,
  title: "موخیتوی کلاسیک",
  slug: "موخیتو کلاسیک",
  excerpt: "خنک و تازه",
  difficulty: "easy",
  total_time_minutes: 15,
  servings: 2,
  image_url: null,
  image_alt: null,
  cocktail_type: "کلاسیک",
  is_featured: true,
  view_count: 10,
  published_at: "2026-07-20T10:00:00Z",
};

describe("RecipeCard", () => {
  it("uses one keyboard destination and a textual difficulty label", () => {
    const markup = renderToStaticMarkup(
      <RecipeCard recipe={recipe} headingLevel={3} />,
    );

    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).toContain("<h3");
    expect(markup).toContain("آسان");
    expect(markup).toContain("۱۵ دقیقه");
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain(
      `href="/recipes/${encodeURIComponent(recipe.slug)}"`,
    );
  });
});
