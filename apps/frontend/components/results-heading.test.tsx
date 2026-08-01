// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResultsHeading } from "./results-heading";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("ResultsHeading", () => {
  it("moves focus only after navigation targets the result region", () => {
    const props = {
      id: "recipe-results-title",
      eyebrow: "جدیدترین",
      title: "دستورها",
      status: "۱۲ دستور",
    };
    const { rerender } = render(<ResultsHeading {...props} focusKey="one" />);
    expect(screen.getByRole("heading", { level: 2 })).not.toHaveFocus();

    window.history.replaceState(
      null,
      "",
      "/recipes?page=2#recipe-results-title",
    );
    rerender(<ResultsHeading {...props} focusKey="two" />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("۱۲ دستور");
  });
});
