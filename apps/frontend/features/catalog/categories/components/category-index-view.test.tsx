// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CategoryTree } from "@/features/catalog/categories/types";
import { getCategoryHref } from "@/features/catalog/categories/utils";
import { absoluteUrl } from "@/lib/site";

const mocks = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/storefront-media", () => {
  const React = require("react") as typeof import("react");
  return {
    StorefrontMedia: ({
      src,
      alt,
      monogram = "ر",
    }: {
      src?: string | null;
      alt: string;
      monogram?: string;
    }) => {
      const [failed, setFailed] = React.useState(false);
      if (!src || failed) {
        return (
          <div role="img" aria-label={alt}>
            {monogram}
          </div>
        );
      }
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          alt={alt}
          data-src={src}
          src={src}
          onError={() => setFailed(true)}
        />
      );
    },
  };
});

vi.mock("@/features/catalog/categories/api", () => ({
  getCategoryTree: mocks.getCategoryTree,
}));

vi.mock("@/features/motion/components/reveal", () => ({
  Reveal: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-reveal="true" className={className}>
      {children}
    </div>
  ),
}));

import { CategoryDirectoryCard } from "./category-directory-card";
import { CategoryIndexView } from "./category-index-view";

type ItemListSchema = {
  "@type": "ItemList";
  name: string;
  url?: string;
  itemListElement: ListItemSchema[];
};

type ListItemSchema = {
  "@type": "ListItem";
  position: number;
  item: ItemListSchema;
};

type CollectionSchema = {
  "@type": "CollectionPage";
  name: string;
  url: string;
  mainEntity: ItemListSchema;
};

const root: CategoryTree = {
  id: 1,
  title: "نوشیدنی‌های منتخب",
  slug: "selected",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCategoryTree.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("category index storefront", () => {
  it("renders a valid empty tree without presenting it as an operational error", async () => {
    render(await CategoryIndexView());

    expect(
      screen.getByText("هنوز دسته‌بندی‌ای برای نمایش نیست"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "با اضافه‌شدن دسته‌بندی‌ها، مسیرهای تازهٔ کاوش در این صفحه ظاهر می‌شوند.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("سرویس");
    expect(document.body).not.toHaveTextContent("خطا");
  });

  it("lets operational failures reach the categories error boundary", async () => {
    const failure = new Error("category transport failed");
    mocks.getCategoryTree.mockRejectedValue(failure);

    await expect(CategoryIndexView()).rejects.toBe(failure);
  });

  it("keeps a slugless root and exposes its complete three-level route hierarchy in keyboard order", async () => {
    const grandchild: CategoryTree = {
      id: 3,
      title: "ذخیرهٔ بلوط",
      slug: "oak?reserve",
    };
    const child: CategoryTree = {
      id: 2,
      title: "انتخاب ویژه",
      slug: "ویژه / A",
      children: [grandchild],
    };
    const structuralRoot: CategoryTree = {
      id: 1,
      title: "راهنمای سردابه",
      children: [child],
    };
    mocks.getCategoryTree.mockResolvedValue([structuralRoot]);

    const { container } = render(await CategoryIndexView());
    const article = screen
      .getByRole("heading", { level: 2, name: structuralRoot.title })
      .closest("article");

    expect(article).not.toBeNull();
    const links = within(article!).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      getCategoryHref(child),
      getCategoryHref(grandchild),
    ]);
    expect(
      within(article!).queryByRole("link", { name: structuralRoot.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 4, name: child.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 5, name: grandchild.title }),
    ).toBeInTheDocument();
    expect(links[0]?.closest("li")).toContainElement(links[1]!);
    expect(container).not.toHaveTextContent("undefined");
    expect(document.body).toHaveTextContent("۲ زیرشاخهٔ قابل‌مشاهده");
    expect(document.body).not.toHaveTextContent("محصول در این دسته");
  });

  it("shows every child beyond four and labels the count as routeable descendants", async () => {
    const children = Array.from({ length: 6 }, (_, index) => ({
      id: index + 2,
      title: `زیرشاخه ${index + 1}`,
      slug: `child-${index + 1}`,
    }));
    mocks.getCategoryTree.mockResolvedValue([{ ...root, children }]);

    render(await CategoryIndexView());

    for (const child of children) {
      expect(
        screen.getByRole("link", { name: new RegExp(child.title) }),
      ).toHaveAttribute("href", getCategoryHref(child));
    }
    expect(document.body).toHaveTextContent("۶ زیرشاخهٔ قابل‌مشاهده");
    expect(document.body).not.toHaveTextContent("+۲ زیرشاخه");
  });

  it("passes real images through StorefrontMedia and retains absent and failed fallbacks", () => {
    const category: CategoryTree = {
      ...root,
      title: "تصویر اصلی",
      image_url: "https://cdn.example.com/category.jpg",
      children: [
        {
          id: 2,
          title: "بدون تصویر",
          slug: "no-image",
        },
      ],
    };
    render(<CategoryDirectoryCard category={category} />);

    const image = screen.getByRole("img", {
      name: `تصویر دسته‌بندی ${category.title}`,
    });
    expect(image).toHaveAttribute("data-src", category.image_url);
    expect(
      screen.getByRole("img", { name: "تصویر دسته‌بندی بدون تصویر" }),
    ).toHaveTextContent("ب");

    fireEvent.error(image);

    const failedFallback = screen.getByRole("img", {
      name: `تصویر دسته‌بندی ${category.title}`,
    });
    expect(failedFallback).not.toHaveAttribute("data-src");
    expect(failedFallback).toHaveTextContent("ت");
  });

  it("uses semantic cards and lists with equal-height wrappers, visible focus, and 44px targets", async () => {
    const child: CategoryTree = {
      id: 2,
      title: "زیرشاخه",
      slug: "child",
    };
    mocks.getCategoryTree.mockResolvedValue([{ ...root, children: [child] }]);

    const { container } = render(await CategoryIndexView());
    const article = container.querySelector("article[aria-labelledby]");
    const categoryLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[data-category]"),
    );

    expect(article).not.toBeNull();
    expect(article?.querySelector("section[aria-labelledby]")).not.toBeNull();
    expect(article?.querySelectorAll("ul > li")).toHaveLength(1);
    expect(container.querySelector("ul.grid > li > [data-reveal]")).toHaveClass(
      "h-full",
    );
    expect(container.querySelector("ul.grid")).toHaveClass(
      "sm:grid-cols-2",
      "lg:grid-cols-3",
    );
    expect(article).toHaveClass("min-w-0", "overflow-hidden");
    expect(categoryLinks).toHaveLength(2);
    for (const link of categoryLinks) {
      expect(link).toHaveClass("min-h-11", "focus-visible:ring-2");
    }
  });

  it("emits hierarchical CollectionPage data using only encoded routeable URLs", async () => {
    const grandchild: CategoryTree = {
      id: 3,
      title: "سطح سوم",
      slug: "سطح سوم?",
    };
    const child: CategoryTree = {
      id: 2,
      title: "سطح دوم",
      slug: "level / two",
      children: [grandchild],
    };
    mocks.getCategoryTree.mockResolvedValue([
      { id: 1, title: "گروه بدون نشانی", children: [child] },
    ]);

    const { container } = render(await CategoryIndexView());
    const payloads = Array.from(
      container.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]',
      ),
      (script) =>
        JSON.parse(script.textContent ?? "{}") as Record<string, unknown>,
    );
    const collection = payloads.find(
      (payload) => payload["@type"] === "CollectionPage",
    ) as CollectionSchema | undefined;

    expect(collection).toBeDefined();
    expect(collection?.url).toBe(absoluteUrl("/categories"));
    const structuralGroup = collection!.mainEntity.itemListElement[0]!.item;
    expect(structuralGroup["@type"]).toBe("ItemList");
    expect(structuralGroup).not.toHaveProperty("url");

    const childList = structuralGroup.itemListElement[0]!.item;
    expect(childList.url).toBe(absoluteUrl(getCategoryHref(child)!));
    expect(childList.itemListElement[0]?.item).toMatchObject({
      "@type": "ItemList",
      url: absoluteUrl(getCategoryHref(grandchild)!),
    });

    const serialized = JSON.stringify(collection);
    expect(serialized).not.toContain("undefined");
    expect(serialized).not.toContain("/categories/undefined");
  });
});
