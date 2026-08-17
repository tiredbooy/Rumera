// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductOptionGroup } from "@/features/admin/products/types";

const group: ProductOptionGroup = {
  id: 3,
  title: "volume",
  display_name: "حجم",
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  values: [
    {
      id: 7,
      option_type_id: 3,
      value: "۷۵۰ml",
      sort_order: 0,
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
    },
  ],
};

vi.mock("@/features/admin/options/api", () => ({
  OptionApiError: class OptionApiError extends Error {},
  useDeleteOptionType: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  }),
  useOptionCatalog: () => ({
    data: [group],
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

import { OptionsBoard } from "./options-board";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OptionsBoard write gate", () => {
  it("hides create / edit / delete without write", () => {
    render(<OptionsBoard canWrite={false} />);

    expect(screen.getByText("حجم")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /ویژگی جدید/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /ویرایش حجم/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /حذف حجم/ }),
    ).not.toBeInTheDocument();
  });

  it("shows write actions when canWrite", () => {
    render(<OptionsBoard canWrite />);

    expect(
      screen.getByRole("link", { name: /ویژگی جدید/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ویرایش حجم/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /حذف حجم/ }),
    ).toBeInTheDocument();
  });
});
