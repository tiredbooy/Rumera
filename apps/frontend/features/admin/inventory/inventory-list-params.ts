export const ADMIN_INVENTORY_PAGE_SIZE = 20;
export const ADMIN_INVENTORY_SEARCH_MAX_LENGTH = 200;

export type InventorySearchParamValue = string | string[] | undefined;

export type InventorySearchParams = {
  q?: InventorySearchParamValue;
  search?: InventorySearchParamValue;
  page?: InventorySearchParamValue;
  low_stock?: InventorySearchParamValue;
};

export type AdminInventoryListFilters = {
  query: string;
  page: number;
  lowStock: boolean;
};

function first(value: InventorySearchParamValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parsePage(value: InventorySearchParamValue): number {
  const raw = first(value);
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

function parseLowStock(value: InventorySearchParamValue): boolean {
  const raw = first(value).trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function parseAdminInventoryListParams(
  searchParams: InventorySearchParams,
): AdminInventoryListFilters {
  const query = (first(searchParams.q) || first(searchParams.search))
    .trim()
    .slice(0, ADMIN_INVENTORY_SEARCH_MAX_LENGTH);

  return {
    query,
    page: parsePage(searchParams.page),
    lowStock: parseLowStock(searchParams.low_stock),
  };
}

export function hasAdminInventoryListFilters(
  filters: AdminInventoryListFilters,
): boolean {
  return Boolean(filters.query) || filters.lowStock;
}

export function inventoryPageHref(
  filters: AdminInventoryListFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.lowStock) params.set("low_stock", "true");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
}
