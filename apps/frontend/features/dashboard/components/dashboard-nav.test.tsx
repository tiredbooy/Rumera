// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders",
}));

import { PERMISSIONS } from "@/lib/rbac/permissions";
import { faNum } from "@/lib/products";

import { DashboardNav, NAV_COLLAPSE_STORAGE_KEY } from "./dashboard-nav";

const allPermissions = Object.values(PERMISSIONS);

function stubLocalStorage() {
  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal("localStorage", memory);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memory,
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  stubLocalStorage();
});

function renderAdmin(
  badges?: Record<string, number | null | undefined>,
  permissions: string[] = allPermissions,
) {
  return render(
    <DashboardNav variant="admin" permissions={permissions} badges={badges} />,
  );
}

describe("DashboardNav", () => {
  it("renders multi-item groups as accordion parents and dashboard as a lone link", () => {
    renderAdmin();

    expect(screen.queryByText("امروز")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "داشبورد" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("button", { name: "کار روزانه" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "کاتالوگ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "مشتریان" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "بازاریابی و محتوا" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "پیکربندی" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "سفارش‌ها" })).toHaveAttribute(
      "href",
      "/admin/orders",
    );
    expect(screen.getByRole("link", { name: "پرداخت‌ها" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "دیدگاه‌ها" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "موجودی" })).toBeInTheDocument();
  });

  it("collapses setup by default so infrequent links are hidden", () => {
    renderAdmin();

    expect(screen.queryByRole("link", { name: "تنظیمات" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "ارسال و مناطق" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "پیکربندی" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("persists setup expand/collapse in localStorage", async () => {
    renderAdmin();

    fireEvent.click(screen.getByRole("button", { name: "پیکربندی" }));
    expect(screen.getByRole("link", { name: "تنظیمات" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "پیکربندی" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(window.localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY)).toContain(
      '"setup":false',
    );

    cleanup();
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "تنظیمات" })).toBeInTheDocument();
    });
  });

  it("renders S-1 pending counts end-aligned on daily-work items", () => {
    renderAdmin({
      "/admin/orders": 6,
      "/admin/reviews": 4,
      "/admin/inventory": 5,
    });

    expect(
      screen.getByRole("link", { name: `سفارش‌ها، ${faNum(6)} مورد در انتظار` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `دیدگاه‌ها، ${faNum(4)} مورد در انتظار` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `موجودی، ${faNum(5)} مورد در انتظار` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "پرداخت‌ها" })).toBeInTheDocument();
  });

  it("rolls pending counts onto a collapsed parent", () => {
    renderAdmin({ "/admin/products": 3 });

    const parent = screen.getByRole("button", {
      name: `کاتالوگ، ${faNum(3)} مورد در انتظار`,
    });
    fireEvent.click(parent);
    expect(
      screen.queryByRole("link", { name: `محصولات، ${faNum(3)} مورد در انتظار` }),
    ).not.toBeInTheDocument();
    expect(parent).toHaveAttribute("aria-expanded", "false");
  });

  it("does not show a zero or failed count as a badge", () => {
    renderAdmin({
      "/admin/orders": 0,
      "/admin/reviews": null,
    });

    expect(screen.getByRole("link", { name: "سفارش‌ها" })).toBeInTheDocument();
    expect(screen.queryByText(faNum(0))).not.toBeInTheDocument();
  });
});
