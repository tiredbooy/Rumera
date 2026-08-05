import {
  isProductSortDirection,
  isProductSortField,
  type ProductSortDirection,
  type ProductSortField,
} from "@/features/catalog/products/queries";

export const PRODUCT_LIST_PAGE_SIZE = 12;
export const PRODUCT_LIST_SEARCH_MAX_LENGTH = 80;

/** Storefront sort control — labels map 1:1 to backend-supported fields. */
export const PRODUCT_LIST_SORT_OPTIONS = [
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
] as const satisfies readonly {
  value: string;
  label: string;
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
}[];

export type ProductListSortMode =
  (typeof PRODUCT_LIST_SORT_OPTIONS)[number]["value"];

export type ProductListSearchParamValue = string | string[] | undefined;
export type ProductListSearchParamsRecord = Record<
  string,
  ProductListSearchParamValue
>;

export type ProductListRouteQuery = {
  page: number;
  search?: string;
  /** Backend product list filter: exact brand id when present. */
  brandId?: number;
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
  sortMode: ProductListSortMode;
  needsRedirect: boolean;
};

const QUERY_KEYS = new Set(["page", "search", "sortBy", "orderBy", "brand_id"]);

function parsePage(value: ProductListSearchParamValue): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

function matchSortOption(
  sortBy: ProductSortField,
  orderBy: ProductSortDirection,
): (typeof PRODUCT_LIST_SORT_OPTIONS)[number] | undefined {
  return PRODUCT_LIST_SORT_OPTIONS.find(
    (option) => option.sortBy === sortBy && option.orderBy === orderBy,
  );
}

/** Parse /products search params into a canonical, backend-safe query. */
export function parseProductListRouteQuery(
  searchParams: ProductListSearchParamsRecord,
): ProductListRouteQuery {
  let needsRedirect = Object.entries(searchParams).some(
    ([key, value]) => value !== undefined && !QUERY_KEYS.has(key),
  );

  // Legacy footer/share links used `sort=discount` / `sort=new` (unsupported).
  if (searchParams.sort !== undefined) needsRedirect = true;

  const parsedPage = parsePage(searchParams.page);
  const page = parsedPage ?? 1;
  if (parsedPage === null || searchParams.page === "1") needsRedirect = true;

  let search: string | undefined;
  const rawSearch = searchParams.search;
  if (rawSearch !== undefined) {
    if (typeof rawSearch !== "string") {
      needsRedirect = true;
    } else {
      const trimmed = rawSearch.trim();
      const bounded = Array.from(trimmed)
        .slice(0, PRODUCT_LIST_SEARCH_MAX_LENGTH)
        .join("");
      search = bounded || undefined;
      if (rawSearch !== bounded) needsRedirect = true;
    }
  }

  let brandId: number | undefined;
  const rawBrandId = searchParams.brand_id;
  if (rawBrandId !== undefined) {
    if (typeof rawBrandId !== "string" || !/^[1-9]\d*$/.test(rawBrandId)) {
      needsRedirect = true;
    } else {
      const parsed = Number(rawBrandId);
      if (Number.isSafeInteger(parsed)) {
        brandId = parsed;
      } else {
        needsRedirect = true;
      }
    }
  }

  let sortBy: ProductSortField = "created_at";
  let orderBy: ProductSortDirection = "desc";

  const rawSortBy = searchParams.sortBy;
  const rawOrderBy = searchParams.orderBy;

  if (rawSortBy !== undefined) {
    if (typeof rawSortBy === "string" && isProductSortField(rawSortBy)) {
      sortBy = rawSortBy;
    } else {
      needsRedirect = true;
    }
  }
  if (rawOrderBy !== undefined) {
    if (typeof rawOrderBy === "string" && isProductSortDirection(rawOrderBy)) {
      orderBy = rawOrderBy;
    } else {
      needsRedirect = true;
    }
  }

  // Prefer a known control mode; unknown field/direction pairs still query the
  // API with allowlisted values but canonicalize the URL when possible.
  const matched = matchSortOption(sortBy, orderBy);
  const sortMode: ProductListSortMode = matched?.value ?? "newest";
  if (!matched && (rawSortBy !== undefined || rawOrderBy !== undefined)) {
    // e.g. sortBy=updated_at from an external link — keep API fields, no mode.
  }
  if (sortBy === "created_at" && orderBy === "desc" && rawSortBy !== undefined) {
    needsRedirect = true;
  }

  return { page, search, brandId, sortBy, orderBy, sortMode, needsRedirect };
}

export function productListHref(
  query: Pick<
    ProductListRouteQuery,
    "search" | "sortBy" | "orderBy" | "brandId"
  >,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.brandId != null) params.set("brand_id", String(query.brandId));
  if (!(query.sortBy === "created_at" && query.orderBy === "desc")) {
    params.set("sortBy", query.sortBy);
    params.set("orderBy", query.orderBy);
  }
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/products?${value}` : "/products";
}

/** Deep-link to the full catalogue filtered by a single brand. */
export function productListBrandHref(brandId: number): string {
  return productListHref(
    { brandId, sortBy: "created_at", orderBy: "desc" },
    1,
  );
}

export function productListSortSelectValue(
  sortBy: ProductSortField,
  orderBy: ProductSortDirection,
): string {
  return `${sortBy}:${orderBy}`;
}
