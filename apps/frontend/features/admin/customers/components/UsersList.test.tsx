// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
    expect(screen.getByRole("button", { name: "اعمال فیلترها" })).toBeVisible();
  });
});
