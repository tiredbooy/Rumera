"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Boxes,
  ClipboardList,
  Newspaper,
  Package,
  Search,
  Sparkles,
  TicketPercent,
  Users,
} from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import type { ProductListItem } from "@/features/catalog/products/types";
import type { Coupon } from "@/features/coupons/types";
import type { UserListItem } from "@/features/customers/types";
import type { InventoryItem } from "@/features/inventory/types";
import type { JournalListItem } from "@/features/journal/types";
import type { AdminRecipeListItem } from "@/features/recipes/types";
import { faNum } from "@/lib/products";
import { can } from "@/lib/rbac/can";
import { ADMIN_NAV, filterNav } from "@/lib/rbac/nav";
import { PERMISSIONS, type Permission } from "@/lib/rbac/permissions";

import {
  COMMAND_ACTIONS,
  COMMAND_SEARCH_MIN_LENGTH,
  couponHref,
  customerHref,
  customersSearchHref,
  flattenNavItems,
  inventoryHref,
  journalHref,
  matchCommandActions,
  matchNavItems,
  normalizeCommandQuery,
  orderHref,
  parseOrderIdQuery,
  productHref,
  productsSearchHref,
  recipeHref,
  searchAdminCoupons,
  searchAdminCustomers,
  searchAdminInventory,
  searchAdminJournal,
  searchAdminProducts,
  searchAdminRecipes,
} from "./admin-command-search";

const SEARCH_DEBOUNCE_MS = 200;

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useCommandSource<T>(
  enabled: boolean,
  query: string,
  searcher: (q: string) => Promise<T[]>,
) {
  const [rows, setRows] = React.useState<T[]>([]);
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setRows([]);
      setPending(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setPending(true);
    setFailed(false);
    void searcher(query)
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, query, searcher]);

  return { rows, pending, failed };
}

export function AdminCommandTrigger({
  onOpen,
  variant = "search",
}: {
  onOpen: () => void;
  variant?: "search" | "icon";
}) {
  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-haspopup="dialog"
        aria-label="جستجو در پنل"
        onClick={onOpen}
      >
        <Search />
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label="جستجو در پنل"
      className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Search className="size-4 shrink-0" />
      <span className="truncate">جستجو در پنل…</span>
      <kbd
        className="ms-auto hidden rounded border border-border/70 bg-background/60 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground sm:inline-block"
        dir="ltr"
      >
        ⌘K
      </kbd>
    </button>
  );
}

export function AdminCommandMenu({
  permissions,
  open: openProp,
  onOpenChange,
  trigger = "search",
}: {
  permissions: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: "search" | "icon" | "none";
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [query, setQuery] = React.useState("");
  const session = React.useMemo(
    () => ({ permissions: permissions as Permission[] }),
    [permissions],
  );
  const canProducts = can(session, PERMISSIONS.PRODUCTS_READ);
  const canCustomers = can(session, PERMISSIONS.CUSTOMERS_READ);
  const canOrders = can(session, PERMISSIONS.ORDERS_READ);
  const canInventory = can(session, PERMISSIONS.INVENTORY_READ);
  const canCoupons = can(session, PERMISSIONS.COUPONS_MANAGE);
  const canJournal = can(session, PERMISSIONS.JOURNAL_READ);
  const canRecipes = can(session, PERMISSIONS.RECIPES_READ);

  const pages = React.useMemo(
    () => flattenNavItems(filterNav(ADMIN_NAV, session)),
    [session],
  );
  const allowedPermissions = React.useMemo(
    () => new Set(session.permissions),
    [session],
  );

  const normalized = normalizeCommandQuery(query);
  const debounced = useDebouncedValue(normalized, SEARCH_DEBOUNCE_MS);
  const navMatches = matchNavItems(pages, normalized);
  const actions = matchCommandActions(
    COMMAND_ACTIONS,
    normalized,
    allowedPermissions,
  );
  const orderId = canOrders ? parseOrderIdQuery(normalized) : null;
  const searchReady = open && debounced.length >= COMMAND_SEARCH_MIN_LENGTH;

  const products = useCommandSource<ProductListItem>(
    searchReady && canProducts,
    debounced,
    searchAdminProducts,
  );
  const customers = useCommandSource<UserListItem>(
    searchReady && canCustomers,
    debounced,
    searchAdminCustomers,
  );
  const inventory = useCommandSource<InventoryItem>(
    searchReady && canInventory,
    debounced,
    searchAdminInventory,
  );
  const coupons = useCommandSource<Coupon>(
    searchReady && canCoupons,
    debounced,
    searchAdminCoupons,
  );
  const journal = useCommandSource<JournalListItem>(
    searchReady && canJournal,
    debounced,
    searchAdminJournal,
  );
  const recipes = useCommandSource<AdminRecipeListItem>(
    searchReady && canRecipes,
    debounced,
    searchAdminRecipes,
  );

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const showProductBoard = canProducts && normalized.length > 0;
  const showCustomerBoard = canCustomers && normalized.length > 0;
  const hasRows =
    navMatches.length > 0 ||
    actions.length > 0 ||
    products.rows.length > 0 ||
    customers.rows.length > 0 ||
    inventory.rows.length > 0 ||
    coupons.rows.length > 0 ||
    journal.rows.length > 0 ||
    recipes.rows.length > 0 ||
    orderId !== null ||
    showProductBoard ||
    showCustomerBoard;

  return (
    <>
      {trigger === "none" ? null : (
        <AdminCommandTrigger
          variant={trigger}
          onOpen={() => setOpen(true)}
        />
      )}

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="جستجو در پنل"
        description="صفحات، دستورها، محصولات و مشتریان. برای سفارش فقط شماره را بنویسید."
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="جستجو…"
            aria-label="جستجو در پنل"
          />
          <CommandList>
            {!hasRows ? (
              <CommandEmpty>
                نتیجه‌ای نیست. نام صفحه، دستور، محصول یا مشتری را بنویسید؛ سفارش
                فقط با شماره.
              </CommandEmpty>
            ) : null}

            {navMatches.length > 0 ? (
              <CommandGroup heading="صفحات">
                {navMatches.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.href}
                      value={`page:${item.href}`}
                      onSelect={() => go(item.href)}
                    >
                      <Icon />
                      {item.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {actions.length > 0 ? (
              <CommandGroup heading="دستورها">
                {actions.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={`action:${action.id}`}
                    onSelect={() => go(action.href)}
                  >
                    <Sparkles />
                    {action.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {showProductBoard || products.pending || products.rows.length > 0 ? (
              <CommandGroup heading="محصولات">
                {products.pending ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    در حال جستجوی محصولات…
                  </p>
                ) : null}
                {products.failed ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    جستجوی محصولات ناموفق بود. فهرست را باز کنید.
                  </p>
                ) : null}
                {products.rows.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={`product:${product.id}`}
                    onSelect={() => go(productHref(product.id))}
                  >
                    <Package />
                    <span className="min-w-0 truncate">{product.title}</span>
                    {product.brand ? (
                      <span className="ms-auto truncate text-xs text-muted-foreground">
                        {product.brand}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
                {showProductBoard ? (
                  <CommandItem
                    value={`products-board:${normalized}`}
                    onSelect={() => go(productsSearchHref(normalized))}
                  >
                    <Search />
                    جستجو در محصولات
                    <span className="truncate text-muted-foreground">
                      {normalized}
                    </span>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}

            {orderId !== null ? (
              <CommandGroup heading="سفارش‌ها">
                <CommandItem
                  value={`order:${orderId}`}
                  onSelect={() => go(orderHref(orderId))}
                >
                  <ClipboardList />
                  سفارش #{faNum(orderId)}
                </CommandItem>
              </CommandGroup>
            ) : null}

            {showCustomerBoard || customers.pending || customers.rows.length > 0 ? (
              <CommandGroup heading="مشتریان">
                {customers.pending ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    در حال جستجوی مشتریان…
                  </p>
                ) : null}
                {customers.failed ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    جستجوی مشتریان ناموفق بود. فهرست را باز کنید.
                  </p>
                ) : null}
                {customers.rows.map((customer) => (
                  <CommandItem
                    key={customer.user_id}
                    value={`customer:${customer.user_id}`}
                    onSelect={() => go(customerHref(customer.user_id))}
                  >
                    <Users />
                    <span className="min-w-0 truncate">
                      {customer.full_name || customer.email}
                    </span>
                    <span className="ms-auto truncate text-xs text-muted-foreground">
                      {customer.email}
                    </span>
                  </CommandItem>
                ))}
                {showCustomerBoard ? (
                  <CommandItem
                    value={`customers-board:${normalized}`}
                    onSelect={() => go(customersSearchHref(normalized))}
                  >
                    <Search />
                    جستجو در مشتریان
                    <span className="truncate text-muted-foreground">
                      {normalized}
                    </span>
                  </CommandItem>
                ) : null}
              </CommandGroup>
            ) : null}

            {inventory.pending || inventory.rows.length > 0 ? (
              <CommandGroup heading="موجودی">
                {inventory.pending ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    در حال جستجوی موجودی…
                  </p>
                ) : null}
                {inventory.rows.map((item) => (
                  <CommandItem
                    key={item.product_variant_id}
                    value={`inventory:${item.product_variant_id}`}
                    onSelect={() => go(inventoryHref(item.product_variant_id))}
                  >
                    <Boxes />
                    <span className="min-w-0 truncate">
                      {item.sku || item.product_title}
                    </span>
                    {item.sku ? (
                      <span className="ms-auto truncate text-xs text-muted-foreground">
                        {item.product_title}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {coupons.pending || coupons.rows.length > 0 ? (
              <CommandGroup heading="کدهای تخفیف">
                {coupons.pending ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    در حال جستجوی کد تخفیف…
                  </p>
                ) : null}
                {coupons.rows.map((coupon) => (
                  <CommandItem
                    key={coupon.id}
                    value={`coupon:${coupon.id}`}
                    onSelect={() => go(couponHref(coupon.id))}
                  >
                    <TicketPercent />
                    <span className="min-w-0 truncate font-mono">{coupon.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {journal.pending || journal.rows.length > 0 ? (
              <CommandGroup heading="ژورنال">
                {journal.pending ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    در حال جستجوی نوشته‌ها…
                  </p>
                ) : null}
                {journal.rows.map((post) => (
                  <CommandItem
                    key={post.id}
                    value={`journal:${post.id}`}
                    onSelect={() => go(journalHref(post.id))}
                  >
                    <Newspaper />
                    <span className="min-w-0 truncate">{post.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {recipes.pending || recipes.rows.length > 0 ? (
              <CommandGroup heading="دستور پخت">
                {recipes.pending ? (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    در حال جستجوی دستور پخت…
                  </p>
                ) : null}
                {recipes.rows.map((recipe) => (
                  <CommandItem
                    key={recipe.id}
                    value={`recipe:${recipe.id}`}
                    onSelect={() => go(recipeHref(recipe.id))}
                  >
                    <BookOpen />
                    <span className="min-w-0 truncate">{recipe.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
