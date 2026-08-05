import type {
  ProductSortDirection,
  ProductSortField,
} from "@/features/catalog/products/queries";

export const CATEGORY_PAGE_SIZE = 12;
export const CATEGORY_SEARCH_MAX_LENGTH = 80;

export const CATEGORY_SORT_OPTIONS = [
  {
    value: "newest",
    label: "جدیدترین",
    sortBy: "created_at",
    orderBy: "desc",
  },
  {
    value: "price-asc",
    label: "ارزان‌ترین",
    sortBy: "price",
    orderBy: "asc",
  },
  {
    value: "price-desc",
    label: "گران‌ترین",
    sortBy: "price",
    orderBy: "desc",
  },
  {
    value: "alphabetical",
    label: "حروف الفبا",
    sortBy: "title",
    orderBy: "asc",
  },
  {
    value: "recently-updated",
    label: "تازه به‌روزشده",
    sortBy: "updated_at",
    orderBy: "desc",
  },
] as const satisfies readonly {
  value: string;
  label: string;
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
}[];

export type CategorySortMode = (typeof CATEGORY_SORT_OPTIONS)[number]["value"];
export type CategorySearchParamValue = string | string[] | undefined;
export type CategorySearchParamsRecord = Record<
  string,
  CategorySearchParamValue
>;
export type CategoryPageSearchParams = Promise<CategorySearchParamsRecord>;

export type CategoryRouteQuery = {
  page: number;
  q?: string;
  sort: CategorySortMode;
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
  needsRedirect: boolean;
};

const QUERY_KEYS = new Set(["page", "q", "sort"]);

export function parseCategoryPage(
  value: CategorySearchParamValue,
): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function parseCategoryRouteQuery(
  searchParams: CategorySearchParamsRecord,
): CategoryRouteQuery {
  let needsRedirect = Object.entries(searchParams).some(
    ([key, value]) => value !== undefined && !QUERY_KEYS.has(key),
  );

  const parsedPage = parseCategoryPage(searchParams.page);
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
        .slice(0, CATEGORY_SEARCH_MAX_LENGTH)
        .join("");
      q = bounded || undefined;
      if (rawQuery !== bounded) needsRedirect = true;
    }
  }

  let sort: CategorySortMode = "newest";
  const rawSort = searchParams.sort;
  if (rawSort !== undefined) {
    const option =
      typeof rawSort === "string"
        ? CATEGORY_SORT_OPTIONS.find((candidate) => candidate.value === rawSort)
        : undefined;
    if (option) sort = option.value;
    if (!option || sort === "newest") needsRedirect = true;
  }

  const sortOption = CATEGORY_SORT_OPTIONS.find(
    (option) => option.value === sort,
  )!;

  return {
    page,
    q,
    sort,
    sortBy: sortOption.sortBy,
    orderBy: sortOption.orderBy,
    needsRedirect,
  };
}

export function categoryPath(slug: string): string {
  return `/categories/${encodeURIComponent(slug)}`;
}

export function categoryPageHref(
  basePath: string,
  query: Pick<CategoryRouteQuery, "q" | "sort">,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `${basePath}?${value}` : basePath;
}

export function categoryFilterHref(
  basePath: string,
  query: Pick<CategoryRouteQuery, "q" | "sort">,
): string {
  return categoryPageHref(basePath, query, 1);
}

export function getCategorySortLabel(sort: CategorySortMode): string {
  return (
    CATEGORY_SORT_OPTIONS.find((option) => option.value === sort)?.label ??
    CATEGORY_SORT_OPTIONS[0].label
  );
}
