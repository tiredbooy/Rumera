import type { Metadata } from "next";

import {
  RecipeListView,
  type RecipeListSearchParams,
} from "@/features/recipes/components/recipe-list-view";
import { difficultyFa } from "@/features/recipes/utils";
import {
  getRecipeSortLabel,
  parseRecipeRouteQuery,
  recipePageHref,
} from "@/features/recipes/routing";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

const description =
  "دستورهای کوکتل و ایده‌های میزبانی — قابل جستجو و فیلتر، با محصولات پیشنهادی برای تهیهٔ هر دستور.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: RecipeListSearchParams;
}): Promise<Metadata> {
  const query = parseRecipeRouteQuery(await searchParams);
  const filtered =
    Boolean(query.q) || Boolean(query.difficulty) || query.sort !== "new";
  const title = query.q
    ? `جستجوی «${query.q}» در دستورها`
    : query.difficulty
      ? `دستورهای ${difficultyFa[query.difficulty]}`
      : query.sort !== "new"
        ? `${getRecipeSortLabel(query.sort)} دستورها`
        : query.page > 1
          ? `دستورها، صفحهٔ ${query.page.toLocaleString("fa-IR")}`
          : "دستورها و ایده‌ها";

  return buildMetadata({
    title,
    description,
    path: filtered ? "/recipes" : recipePageHref(query, query.page),
    index: !filtered && !query.needsRedirect,
  });
}

export default function RecipesPage({
  searchParams,
}: {
  searchParams: RecipeListSearchParams;
}) {
  return <RecipeListView searchParams={searchParams} />;
}
