// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductFormSectionNav } from "./SectionNav";
import {
  productFormSectionForTarget,
  readProductFormSection,
} from "./sections";

afterEach(cleanup);

const sections = [
  { key: "general" as const, label: "اطلاعات کلی" },
  { key: "seo" as const, label: "سئو", hasError: true },
];

describe("ProductFormSectionNav", () => {
  it("links each section to its own URL and keeps unrelated params", () => {
    render(
      <ProductFormSectionNav
        sections={sections}
        active="general"
        search="?from=7"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: /سئو/ })).toHaveAttribute(
      "href",
      "?from=7&tab=seo",
    );
    // The default section drops the param rather than pinning `tab=general`.
    expect(screen.getByRole("link", { name: /اطلاعات کلی/ })).toHaveAttribute(
      "href",
      "?from=7",
    );
    expect(screen.getByRole("link", { name: /اطلاعات کلی/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("selects in place instead of navigating", () => {
    const onSelect = vi.fn();
    render(
      <ProductFormSectionNav
        sections={sections}
        active="general"
        search=""
        onSelect={onSelect}
      />,
    );

    const link = screen.getByRole("link", { name: /سئو/ });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(onSelect).toHaveBeenCalledWith("seo");
    expect(event.defaultPrevented).toBe(true);
  });

  it("resolves a modified-click to the browser", () => {
    const onSelect = vi.fn();
    render(
      <ProductFormSectionNav
        sections={sections}
        active="general"
        search=""
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: /سئو/ }), {
      metaKey: true,
    });

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("product form section addressing", () => {
  it("reads a deep link and falls back for anything unknown", () => {
    expect(readProductFormSection("?tab=variants")).toBe("variants");
    expect(readProductFormSection("?tab=nope")).toBe("general");
    expect(readProductFormSection("")).toBe("general");
  });

  it("maps every error-summary target onto the section that holds it", () => {
    expect(productFormSectionForTarget("title")).toBe("general");
    expect(productFormSectionForTarget("weight")).toBe("specs");
    expect(productFormSectionForTarget("product-tags-trigger")).toBe("tags");
    expect(productFormSectionForTarget("variants.12.price")).toBe("variants");
    expect(productFormSectionForTarget("product-variants-trigger")).toBe(
      "variants",
    );
    expect(productFormSectionForTarget("product-images-trigger")).toBe(
      "images",
    );
    expect(productFormSectionForTarget("meta_description")).toBe("seo");
    // The publish switch lives in the action bars, in no section at all.
    expect(productFormSectionForTarget("is_active")).toBeUndefined();
  });
});
