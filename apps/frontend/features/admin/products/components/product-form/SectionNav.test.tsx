// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductFormSectionNav } from "./SectionNav";

afterEach(cleanup);

describe("ProductFormSectionNav", () => {
  it("opens a collapsed section and scrolls to it", () => {
    const scrollIntoView = vi.fn();
    const trigger = document.createElement("button");
    trigger.id = "product-seo-trigger";
    trigger.setAttribute("aria-expanded", "false");
    const click = vi.fn();
    trigger.click = click;

    const section = document.createElement("div");
    section.id = "product-section-seo";
    section.scrollIntoView = scrollIntoView;
    section.append(trigger);
    document.body.append(section);

    render(
      <ProductFormSectionNav
        sections={[{ id: "product-section-seo", label: "سئو" }]}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: /سئو/ }));

    expect(click).toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start" }),
    );

    section.remove();
  });
});
