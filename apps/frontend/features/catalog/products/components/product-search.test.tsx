// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/products",
  useSearchParams: () => mocks.params,
}));

import { parseProductListRouteQuery } from "@/features/catalog/products/list-routing";

import { ProductSearch } from "./product-search";

/** Type a term into the box and submit the form. */
function submit(term: string) {
  const input = screen.getByLabelText("عبارت جستجوی محصول");
  fireEvent.change(input, { target: { value: term } });
  fireEvent.submit(input.closest("form")!);
}

/** The href the box pushed, parsed back through the route parser. */
function pushedQuery() {
  const href = String(mocks.push.mock.calls.at(-1)?.[0]);
  return parseProductListRouteQuery(
    Object.fromEntries(new URLSearchParams(href.split("?")[1] ?? "")),
  );
}

describe("ProductSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = new URLSearchParams();
  });
  afterEach(cleanup);

  it("writes the `search` param the /products parser reads", () => {
    render(<ProductSearch />);

    submit("  ویسکی ژاپنی  ");

    expect(mocks.push).toHaveBeenCalledWith(
      `/products?${new URLSearchParams({ search: "ویسکی ژاپنی" }).toString()}`,
    );
    expect(pushedQuery()).toMatchObject({
      search: "ویسکی ژاپنی",
      needsRedirect: false,
    });
  });

  it("keeps the other catalogue filters and resets pagination", () => {
    mocks.params = new URLSearchParams({
      brand: "jack-daniel",
      sortBy: "price",
      orderBy: "asc",
      page: "3",
      utm_source: "google",
    });
    render(<ProductSearch />);

    submit("رزرو");

    const query = pushedQuery();
    expect(query).toMatchObject({
      search: "رزرو",
      brand: "jack-daniel",
      sortBy: "price",
      orderBy: "asc",
      page: 1,
      needsRedirect: false,
    });
    expect(Object.fromEntries(query.passthrough)).toEqual({
      utm_source: "google",
    });
  });

  it("clears the applied term back to the plain catalogue", () => {
    mocks.params = new URLSearchParams({ search: "رزرو" });
    render(<ProductSearch />);

    expect(screen.getByLabelText("عبارت جستجوی محصول")).toHaveValue("رزرو");

    fireEvent.click(screen.getByLabelText("پاک‌کردن جستجو"));

    expect(mocks.push).toHaveBeenCalledWith("/products");
  });

  it("does not renavigate when the term is unchanged", () => {
    mocks.params = new URLSearchParams({ search: "رزرو" });
    render(<ProductSearch />);

    fireEvent.click(screen.getByLabelText("اجرای جستجو"));

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("caps input length so the parser never has to truncate and redirect", () => {
    render(<ProductSearch />);

    expect(screen.getByLabelText("عبارت جستجوی محصول")).toHaveAttribute(
      "maxlength",
      "80",
    );
  });
});
