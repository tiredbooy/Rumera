import type { ProductListItem } from "@/features/catalog/products/types";
import type { Coupon } from "@/features/coupons/types";
import type { UserListItem } from "@/features/customers/types";
import type { InventoryItem } from "@/features/inventory/types";
import type { JournalListItem } from "@/features/journal/types";
import type { AdminRecipeListItem } from "@/features/recipes/types";
import type { ApiErrorEnvelope, Paginated } from "@/lib/api/types";
import { toAsciiDigits } from "@/lib/normalize-digits";
import type { NavGroup, NavItem } from "@/lib/rbac/nav";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import { buildQueryString } from "@/lib/utils/api-helpers";

export const COMMAND_SEARCH_LIMIT = 5;
export const COMMAND_SEARCH_MIN_LENGTH = 2;

export function normalizeCommandQuery(raw: string): string {
  return toAsciiDigits(raw).trim().replace(/\s+/g, " ");
}

export function flattenNavItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((group) => group.items);
}

export function matchNavItems(items: NavItem[], query: string): NavItem[] {
  const needle = normalizeCommandQuery(query).toLocaleLowerCase("fa");
  if (!needle) return items;
  return items.filter((item) => {
    const label = item.label.toLocaleLowerCase("fa");
    const href = item.href.toLocaleLowerCase("en");
    return label.includes(needle) || href.includes(needle);
  });
}

/** Admin orders have no list `search` param — only a short numeric id jump is honest. */
export function parseOrderIdQuery(query: string): number | null {
  const token = normalizeCommandQuery(query);
  if (!/^\d{1,8}$/.test(token)) return null;
  const id = Number(token);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** 10–11 digit Iranian mobiles (ASCII or Eastern digits) — not order ids. */
export function parseCustomerPhoneQuery(query: string): string | null {
  const token = normalizeCommandQuery(query);
  if (!/^[09]\d{9,10}$/.test(token)) return null;
  return token;
}

export function productsSearchHref(query: string): string {
  const q = normalizeCommandQuery(query);
  return q ? `/admin/products?q=${encodeURIComponent(q)}` : "/admin/products";
}

export function customersSearchHref(query: string): string {
  const q = normalizeCommandQuery(query);
  return q ? `/admin/customers?q=${encodeURIComponent(q)}` : "/admin/customers";
}

export function productHref(id: number): string {
  return `/admin/products/${id}`;
}

export function customerHref(userId: string): string {
  return `/admin/customers/${encodeURIComponent(userId)}`;
}

export function inventoryHref(variantId: number): string {
  return `/admin/inventory/${variantId}`;
}

export function couponHref(id: number): string {
  return `/admin/coupons/${id}`;
}

export function journalHref(id: number): string {
  return `/admin/journal/${id}`;
}

export function recipeHref(id: number): string {
  return `/admin/recipes/${id}`;
}

export type CommandAction = {
  id: string;
  label: string;
  href: string;
  permission: Permission;
};

export const COMMAND_ACTIONS: CommandAction[] = [
  {
    id: "new-product",
    label: "محصول جدید",
    href: "/admin/products/new",
    permission: PERMISSIONS.PRODUCTS_WRITE,
  },
  {
    id: "new-coupon",
    label: "کد تخفیف جدید",
    href: "/admin/coupons/new",
    permission: PERMISSIONS.COUPONS_MANAGE,
  },
  {
    id: "issue-gift-card",
    label: "صدور کارت هدیه",
    href: "/admin/gift-cards/new",
    permission: PERMISSIONS.GIFT_CARDS_ISSUE,
  },
  {
    id: "new-journal",
    label: "نوشتهٔ جدید",
    href: "/admin/journal/new",
    permission: PERMISSIONS.JOURNAL_WRITE,
  },
];

export function matchCommandActions(
  actions: CommandAction[],
  query: string,
  allowed: ReadonlySet<Permission>,
): CommandAction[] {
  const permitted = actions.filter((action) => allowed.has(action.permission));
  const needle = normalizeCommandQuery(query).toLocaleLowerCase("fa");
  if (!needle) return permitted;
  return permitted.filter((action) =>
    action.label.toLocaleLowerCase("fa").includes(needle),
  );
}

export function orderHref(id: number): string {
  return `/admin/orders/${id}`;
}

export class CommandSearchError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CommandSearchError";
  }
}

function unwrapResults<T>(body: unknown): T[] {
  if (!body || typeof body !== "object") return [];
  const page = body as Partial<Paginated<T>> & { data?: Partial<Paginated<T>> };
  if (Array.isArray(page.results)) return page.results;
  if (Array.isArray(page.data?.results)) return page.data.results;
  return [];
}

async function fetchAdminList<T>(path: string): Promise<T[]> {
  const response = await fetch(`/api/admin/${path}`);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new CommandSearchError(
      response.status,
      error?.message ?? response.statusText,
    );
  }
  return unwrapResults<T>(body);
}

export function searchAdminProducts(
  query: string,
): Promise<ProductListItem[]> {
  return fetchAdminList<ProductListItem>(
    `admin/products${buildQueryString({
      search: query,
      limit: COMMAND_SEARCH_LIMIT,
    })}`,
  );
}

export function searchAdminCustomers(query: string): Promise<UserListItem[]> {
  return fetchAdminList<UserListItem>(
    `admin/users${buildQueryString({
      search: query,
      limit: COMMAND_SEARCH_LIMIT,
    })}`,
  );
}

export function searchAdminInventory(query: string): Promise<InventoryItem[]> {
  return fetchAdminList<InventoryItem>(
    `admin/inventory${buildQueryString({
      search: query,
      limit: COMMAND_SEARCH_LIMIT,
    })}`,
  );
}

export function searchAdminCoupons(query: string): Promise<Coupon[]> {
  return fetchAdminList<Coupon>(
    `admin/coupons${buildQueryString({
      search: query,
      limit: COMMAND_SEARCH_LIMIT,
    })}`,
  );
}

export function searchAdminJournal(query: string): Promise<JournalListItem[]> {
  return fetchAdminList<JournalListItem>(
    `admin/blogs${buildQueryString({
      search: query,
      limit: COMMAND_SEARCH_LIMIT,
    })}`,
  );
}

export function searchAdminRecipes(
  query: string,
): Promise<AdminRecipeListItem[]> {
  return fetchAdminList<AdminRecipeListItem>(
    `admin/recipes${buildQueryString({
      search: query,
      limit: COMMAND_SEARCH_LIMIT,
    })}`,
  );
}
