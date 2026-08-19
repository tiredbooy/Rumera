import {
  collectRoutePassthrough,
  type RoutePassthrough,
  withRoutePassthrough,
} from "@/features/catalog/route-passthrough";
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
  /** Params the route does not own — carried through any redirect. */
  passthrough: RoutePassthrough;
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
  // A campaign param is not a malformed URL. Unknown keys ride along instead of
  // triggering a redirect that would strip them (see route-passthrough.ts).
  const passthrough = collectRoutePassthrough(searchParams, QUERY_KEYS);
  let needsRedirect = false;

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
    passthrough,
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

/**
 * The href a redirect goes to. Same canonical URL as categoryPageHref, plus the
 * params the route does not own — internal links stay campaign-free, a redirect
 * does not drop the attribution the click arrived with.
 */
export function categoryRedirectHref(
  basePath: string,
  query: Pick<CategoryRouteQuery, "q" | "sort" | "passthrough">,
  page: number,
): string {
  return withRoutePassthrough(
    categoryPageHref(basePath, query, page),
    query.passthrough,
  );
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
