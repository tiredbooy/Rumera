import type {
  RecipeDifficulty,
  RecipeSortDirection,
  RecipeSortField,
} from "@/features/recipes/types";

export const RECIPE_PAGE_SIZE = 12;
export const RECIPE_SEARCH_MAX_LENGTH = 80;

export const RECIPE_SORT_OPTIONS = [
  {
    value: "new",
    label: "جدیدترین",
    sortBy: "published_at",
    orderBy: "desc",
  },
  {
    value: "popular",
    label: "محبوب‌ترین",
    sortBy: "view_count",
    orderBy: "desc",
  },
  {
    value: "quick",
    label: "سریع‌ترین",
    sortBy: "total_time",
    orderBy: "asc",
  },
] as const satisfies readonly {
  value: string;
  label: string;
  sortBy: RecipeSortField;
  orderBy: RecipeSortDirection;
}[];

export type RecipeSortMode = (typeof RECIPE_SORT_OPTIONS)[number]["value"];
export type RecipeSearchParamValue = string | string[] | undefined;
export type RecipeSearchParamsRecord = Record<string, RecipeSearchParamValue>;
export type RecipeListSearchParams = Promise<RecipeSearchParamsRecord>;

export type RecipeRouteQuery = {
  page: number;
  q?: string;
  difficulty?: RecipeDifficulty;
  sort: RecipeSortMode;
  sortBy: RecipeSortField;
  orderBy: RecipeSortDirection;
  needsRedirect: boolean;
};

const QUERY_KEYS = new Set(["page", "q", "difficulty", "sort"]);
const DIFFICULTIES = new Set<RecipeDifficulty>(["easy", "medium", "hard"]);

export function parseRecipePage(value: RecipeSearchParamValue): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function parseRecipeRouteQuery(
  searchParams: RecipeSearchParamsRecord,
): RecipeRouteQuery {
  let needsRedirect = Object.entries(searchParams).some(
    ([key, value]) => value !== undefined && !QUERY_KEYS.has(key),
  );

  const parsedPage = parseRecipePage(searchParams.page);
  const page = parsedPage ?? 1;
  if (parsedPage === null || searchParams.page === "1") needsRedirect = true;

  let q: string | undefined;
  const rawQuery = searchParams.q;
  if (rawQuery !== undefined) {
    if (typeof rawQuery !== "string") {
      needsRedirect = true;
    } else {
      const trimmed = rawQuery.trim();
      const bounded = Array.from(trimmed)
        .slice(0, RECIPE_SEARCH_MAX_LENGTH)
        .join("");
      q = bounded || undefined;
      if (!bounded || rawQuery !== bounded) needsRedirect = true;
    }
  }

  let difficulty: RecipeDifficulty | undefined;
  const rawDifficulty = searchParams.difficulty;
  if (rawDifficulty !== undefined) {
    if (
      typeof rawDifficulty === "string" &&
      DIFFICULTIES.has(rawDifficulty as RecipeDifficulty)
    ) {
      difficulty = rawDifficulty as RecipeDifficulty;
    } else {
      needsRedirect = true;
    }
  }

  let sort: RecipeSortMode = "new";
  const rawSort = searchParams.sort;
  if (rawSort !== undefined) {
    const option =
      typeof rawSort === "string"
        ? RECIPE_SORT_OPTIONS.find((candidate) => candidate.value === rawSort)
        : undefined;
    if (option) sort = option.value;
    if (!option || sort === "new") needsRedirect = true;
  }

  const sortOption = RECIPE_SORT_OPTIONS.find(
    (option) => option.value === sort,
  )!;

  return {
    page,
    q,
    difficulty,
    sort,
    sortBy: sortOption.sortBy,
    orderBy: sortOption.orderBy,
    needsRedirect,
  };
}

export function recipePageHref(
  query: Pick<RecipeRouteQuery, "q" | "difficulty" | "sort">,
  page: number,
  hash?: string,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.difficulty) params.set("difficulty", query.difficulty);
  if (query.sort !== "new") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  const path = value ? `/recipes?${value}` : "/recipes";
  return hash ? `${path}#${hash}` : path;
}

export function getRecipeSortLabel(sort: RecipeSortMode): string {
  return (
    RECIPE_SORT_OPTIONS.find((option) => option.value === sort)?.label ??
    RECIPE_SORT_OPTIONS[0].label
  );
}
