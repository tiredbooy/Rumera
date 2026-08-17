import { z } from "zod";

import {
  isProductSortDirection,
  isProductSortField,
  type ProductSortDirection,
  type ProductSortField,
} from "@/features/catalog/products/queries";

export const ADMIN_PRODUCTS_PAGE_SIZE = 20;
export const ADMIN_PRODUCTS_SEARCH_MAX_LENGTH = 200;

export const ADMIN_PRODUCT_SORT_OPTIONS = [
  {
    value: "newest",
    label: "جدیدترین",
    sortBy: "created_at",
    orderBy: "desc",
  },
  {
    value: "updated",
    label: "آخرین تغییر",
    sortBy: "updated_at",
    orderBy: "desc",
  },
  {
    value: "title",
    label: "نام (الفبا)",
    sortBy: "title",
    orderBy: "asc",
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
] as const satisfies readonly {
  value: string;
  label: string;
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
}[];

export type AdminProductSortValue =
  (typeof ADMIN_PRODUCT_SORT_OPTIONS)[number]["value"];

export type ProductsSearchParamValue = string | string[] | undefined;

export type ProductsSearchParams = {
  q?: ProductsSearchParamValue;
  search?: ProductsSearchParamValue;
  page?: ProductsSearchParamValue;
  is_active?: ProductsSearchParamValue;
  sort?: ProductsSearchParamValue;
  sortBy?: ProductsSearchParamValue;
  orderBy?: ProductsSearchParamValue;
};

export type AdminProductListFilters = {
  query: string;
  page: number;
  isActive?: boolean;
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
};

const DEFAULT_SORT = ADMIN_PRODUCT_SORT_OPTIONS[0];

function first(value: ProductsSearchParamValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parsePage(value: ProductsSearchParamValue): number {
  const parsed = z.coerce.number().int().positive().safeParse(first(value));
  return parsed.success ? parsed.data : 1;
}

function parseIsActive(value: ProductsSearchParamValue): boolean | undefined {
  const raw = first(value).trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "active") return true;
  if (raw === "false" || raw === "0" || raw === "inactive") return false;
  return undefined;
}

export function matchAdminProductSort(
  sortBy: ProductSortField,
  orderBy: ProductSortDirection,
): (typeof ADMIN_PRODUCT_SORT_OPTIONS)[number] | undefined {
  return ADMIN_PRODUCT_SORT_OPTIONS.find(
    (option) => option.sortBy === sortBy && option.orderBy === orderBy,
  );
}

function parseSort(searchParams: ProductsSearchParams): {
  sortBy: ProductSortField;
  orderBy: ProductSortDirection;
} {
  const sortToken = first(searchParams.sort).trim();
  const fromToken = ADMIN_PRODUCT_SORT_OPTIONS.find(
    (option) => option.value === sortToken,
  );
  if (fromToken) {
    return { sortBy: fromToken.sortBy, orderBy: fromToken.orderBy };
  }

  const rawSortBy = first(searchParams.sortBy).trim();
  const rawOrderBy = first(searchParams.orderBy).trim();
  const sortBy = isProductSortField(rawSortBy)
    ? rawSortBy
    : DEFAULT_SORT.sortBy;
  const orderBy = isProductSortDirection(rawOrderBy)
    ? rawOrderBy
    : sortBy === DEFAULT_SORT.sortBy
      ? DEFAULT_SORT.orderBy
      : "desc";

  return { sortBy, orderBy };
}

export function parseAdminProductListParams(
  searchParams: ProductsSearchParams,
): AdminProductListFilters {
  const query = (first(searchParams.q) || first(searchParams.search))
    .trim()
    .slice(0, ADMIN_PRODUCTS_SEARCH_MAX_LENGTH);
  const { sortBy, orderBy } = parseSort(searchParams);

  return {
    query,
    page: parsePage(searchParams.page),
    isActive: parseIsActive(searchParams.is_active),
    sortBy,
    orderBy,
  };
}

export function hasAdminProductListFilters(
  filters: AdminProductListFilters,
): boolean {
  const isDefaultSort =
    filters.sortBy === DEFAULT_SORT.sortBy &&
    filters.orderBy === DEFAULT_SORT.orderBy;
  return (
    Boolean(filters.query) || filters.isActive !== undefined || !isDefaultSort
  );
}

export function productsPageHref(
  filters: AdminProductListFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.isActive === true) params.set("is_active", "true");
  if (filters.isActive === false) params.set("is_active", "false");

  const matched = matchAdminProductSort(filters.sortBy, filters.orderBy);
  if (matched) {
    if (matched.value !== DEFAULT_SORT.value) {
      params.set("sort", matched.value);
    }
  } else {
    params.set("sortBy", filters.sortBy);
    params.set("orderBy", filters.orderBy);
  }

  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}
