// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/customers",
  useSearchParams: () => new URLSearchParams(),
}));

import { UsersFilters } from "./UsersList";

afterEach(cleanup);

describe("UsersFilters", () => {
  it("exposes labeled search, role, and status controls with the URL state", () => {
    render(
      <UsersFilters
        filters={{
          query: "mina",
          page: 2,
          role: "vendor",
          status: "inactive",
        }}
      />,
    );

    expect(screen.getByLabelText("نام، ایمیل یا تلفن")).toHaveValue("mina");
    expect(screen.getByLabelText("نقش")).toHaveValue("vendor");
    expect(screen.getByLabelText("وضعیت")).toHaveValue("inactive");
    // Filters apply as you go now, so there is no «اعمال» button — only the
    // reset link the AdminFilterBar puts in the same corner on every screen.
    expect(
      screen.queryByRole("button", { name: "اعمال فیلترها" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "پاک کردن همهٔ فیلترها" }),
    ).toBeVisible();
  });
});
