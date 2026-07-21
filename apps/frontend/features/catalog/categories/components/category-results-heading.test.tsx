// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CategoryResultsHeading } from "./category-results-heading";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/categories/whisky");
});

describe("CategoryResultsHeading", () => {
  it("focuses refreshed results only when navigation targets the result hash", () => {
    const props = {
      id: "category-products-title",
      title: "محصولات ویسکی",
      status: "۱۲ محصول پیدا شد",
    };
    const { rerender } = render(
      <CategoryResultsHeading {...props} focusKey="page-1" />,
    );

    expect(screen.getByRole("heading", { level: 2 })).not.toHaveFocus();

    window.history.replaceState(
      null,
      "",
      "/categories/whisky?page=2#category-products-title",
    );
    rerender(<CategoryResultsHeading {...props} focusKey="page-2" />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("۱۲ محصول پیدا شد");
  });
});
