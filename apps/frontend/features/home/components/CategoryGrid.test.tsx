import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@/features/catalog/categories/types";

vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./CategoryCard", () => ({
  CategoryCard: ({ category }: { category: Category }) => (
    <article data-category-card={category.id}>{category.title}</article>
  ),
}));

import { CategoryGrid } from "./CategoryGrid";

const featured: Category[] = [
  {
    id: 1,
    title: "شراب",
    slug: "wine",
    is_featured: true,
    display_order: 1,
  },
];

describe("CategoryGrid", () => {
  it("renders nothing when featured categories are empty", () => {
    const markup = renderToStaticMarkup(<CategoryGrid categories={[]} />);

    expect(markup).toBe("");
  });

  it("renders the heading and cards when categories exist", () => {
    const markup = renderToStaticMarkup(
      <CategoryGrid categories={featured} />,
    );

    expect(markup).toContain('id="categories"');
    expect(markup).toContain("خرید بر اساس دسته‌بندی");
    expect(markup).toContain("هر چه می‌خواهید، یک‌جا");
    expect(markup).toContain('data-category-card="1"');
    expect(markup).toContain("شراب");
    expect(markup).toContain('href="/products"');
  });
});
