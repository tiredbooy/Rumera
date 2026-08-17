// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchProducts: vi.fn(),
  searchCustomers: vi.fn(),
  searchInventory: vi.fn(),
  searchCoupons: vi.fn(),
  searchJournal: vi.fn(),
  searchRecipes: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("./admin-command-search", async () => {
  const actual = await vi.importActual<
    typeof import("./admin-command-search")
  >("./admin-command-search");
  return {
    ...actual,
    searchAdminProducts: mocks.searchProducts,
    searchAdminCustomers: mocks.searchCustomers,
    searchAdminInventory: mocks.searchInventory,
    searchAdminCoupons: mocks.searchCoupons,
    searchAdminJournal: mocks.searchJournal,
    searchAdminRecipes: mocks.searchRecipes,
  };
});

import { PERMISSIONS } from "@/lib/rbac/permissions";
import { AdminCommandMenu } from "./admin-command-menu";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const allSearchPerms = [
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.ORDERS_READ,
];

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  mocks.searchProducts.mockResolvedValue([
    { id: 3, title: "ویسکی مالت", brand: "Talisker" },
  ]);
  mocks.searchCustomers.mockResolvedValue([
    { user_id: "u1", full_name: "مینا رضایی", email: "mina@example.com" },
  ]);
  mocks.searchInventory.mockResolvedValue([]);
  mocks.searchCoupons.mockResolvedValue([]);
  mocks.searchJournal.mockResolvedValue([]);
  mocks.searchRecipes.mockResolvedValue([]);
});

function openMenu(permissions: string[] = allSearchPerms) {
  render(<AdminCommandMenu permissions={permissions} />);
  fireEvent.click(screen.getByRole("button", { name: "جستجو در پنل" }));
}

describe("AdminCommandMenu", () => {
  it("opens from the trigger and lists permitted pages", async () => {
    openMenu([PERMISSIONS.PRODUCTS_READ]);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /محصولات/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /کاربران/ })).not.toBeInTheDocument();
  });

  it("searches products and customers, and jumps to a numeric order", async () => {
    openMenu();

    const input = await screen.findByPlaceholderText("جستجو…");
    fireEvent.change(input, { target: { value: "42" } });

    expect(await screen.findByRole("option", { name: /سفارش/ })).toHaveTextContent(
      "۴۲",
    );
    await waitFor(() => {
      expect(mocks.searchProducts).toHaveBeenCalledWith("42");
      expect(mocks.searchCustomers).toHaveBeenCalledWith("42");
    });
    expect(
      await screen.findByRole("option", { name: /ویسکی مالت/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /مینا رضایی/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /ویسکی مالت/ }));
    expect(mocks.push).toHaveBeenCalledWith("/admin/products/3");
  });

  it("jumps to a Persian-digit order id and does not invent one for a mobile", async () => {
    openMenu();

    const input = await screen.findByPlaceholderText("جستجو…");
    fireEvent.change(input, { target: { value: "۱۴۲" } });
    expect(await screen.findByRole("option", { name: /سفارش/ })).toHaveTextContent(
      "۱۴۲",
    );

    fireEvent.change(input, { target: { value: "09121234567" } });
    await waitFor(() => {
      expect(mocks.searchCustomers).toHaveBeenCalledWith("09121234567");
    });
    expect(screen.queryByRole("option", { name: /سفارش/ })).not.toBeInTheDocument();
  });

  it("does not hit product or customer APIs without the matching read grant", async () => {
    openMenu([PERMISSIONS.ORDERS_READ]);

    const input = await screen.findByPlaceholderText("جستجو…");
    fireEvent.change(input, { target: { value: "wine" } });

    expect(await screen.findByText(/نتیجه‌ای نیست/)).toBeInTheDocument();
    expect(mocks.searchProducts).not.toHaveBeenCalled();
    expect(mocks.searchCustomers).not.toHaveBeenCalled();
    expect(screen.queryByRole("option", { name: /سفارش/ })).not.toBeInTheDocument();
    expect(screen.queryByText("جستجو در محصولات")).not.toBeInTheDocument();
    expect(screen.queryByText("جستجو در مشتریان")).not.toBeInTheDocument();
  });

  it("still offers the product board when the live search fails", async () => {
    mocks.searchProducts.mockRejectedValue(new Error("down"));
    openMenu([PERMISSIONS.PRODUCTS_READ]);

    const input = await screen.findByPlaceholderText("جستجو…");
    fireEvent.change(input, { target: { value: "مالت" } });

    expect(
      await screen.findByText("جستجوی محصولات ناموفق بود. فهرست را باز کنید."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /جستجو در محصولات/ }));
    expect(mocks.push).toHaveBeenCalledWith(
      `/admin/products?q=${encodeURIComponent("مالت")}`,
    );
  });

  it("lists permission-gated actions and inventory SKU hits", async () => {
    mocks.searchInventory.mockResolvedValue([
      { product_variant_id: 9, product_title: "مالت", sku: "SKU-9" },
    ]);
    openMenu([PERMISSIONS.PRODUCTS_WRITE, PERMISSIONS.INVENTORY_READ]);

    expect(await screen.findByRole("option", { name: /محصول جدید/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /کد تخفیف جدید/ })).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText("جستجو…");
    fireEvent.change(input, { target: { value: "SKU-9" } });
    expect(await screen.findByRole("option", { name: /SKU-9/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /SKU-9/ }));
    expect(mocks.push).toHaveBeenCalledWith("/admin/inventory/9");
  });
});
