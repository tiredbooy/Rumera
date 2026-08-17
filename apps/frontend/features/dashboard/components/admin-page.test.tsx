// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminContentWidthProvider } from "./admin-content-width";
import { AdminFilterBar, AdminPage } from "./admin-page";

afterEach(cleanup);

describe("AdminPage", () => {
  it("puts the breadcrumb, title, action, filters, content and pager in one fixed order", () => {
    render(
      <AdminPage
        title="سفارش‌ها"
        description="توضیح"
        action={<button type="button">سفارش جدید</button>}
        filters={
          <AdminFilterBar id="f" hasFilters resetHref="/admin/orders">
            <input aria-label="جستجو" />
          </AdminFilterBar>
        }
        pagination={<nav aria-label="صفحه‌بندی" />}
      >
        <p>فهرست</p>
      </AdminPage>,
    );

    // Breadcrumb defaults to the console root plus the current page.
    const crumbs = screen.getByRole("navigation", { name: "مسیر صفحه" });
    expect(crumbs).toHaveTextContent("پنل مدیریت");
    expect(crumbs).toHaveTextContent("سفارش‌ها");
    expect(screen.getByRole("link", { name: "پنل مدیریت" })).toHaveAttribute(
      "href",
      "/admin",
    );

    const order = ["مسیر صفحه", "جستجو و فیلتر", "فهرست", "صفحه‌بندی"];
    const rendered = [
      crumbs,
      screen.getByRole("heading", { name: /جستجو و فیلتر/ }),
      screen.getByText("فهرست"),
      screen.getByRole("navigation", { name: "صفحه‌بندی" }),
    ];
    // Each node must precede the next in document order.
    for (let i = 0; i < rendered.length - 1; i += 1) {
      expect(
        rendered[i].compareDocumentPosition(rendered[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        `${order[i]} should come before ${order[i + 1]}`,
      ).toBeTruthy();
    }

    // The reset lives in the filter bar, in the same corner on every screen.
    expect(
      screen.getByRole("link", { name: "پاک کردن همهٔ فیلترها" }),
    ).toHaveAttribute("href", "/admin/orders");

    // S-6: compact title, no filter card, standing copy in a popover.
    expect(screen.getByRole("heading", { level: 1, name: "سفارش‌ها" })).toHaveClass(
      "text-xl",
    );
    expect(screen.getByRole("heading", { name: /جستجو و فیلتر/ })).toHaveClass(
      "sr-only",
    );
    expect(screen.getByLabelText("جستجو").closest("section")).not.toHaveClass(
      "rounded-2xl",
    );
    expect(
      screen.queryByText("توضیح", { selector: "header p" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "راهنمای صفحه" }));
    expect(screen.getByText("توضیح")).toBeVisible();
  });

  it("omits the slots a screen does not have, and the pager gap with them", () => {
    const { container } = render(
      <AdminPage title="نقش‌ها">
        <p>محتوا</p>
      </AdminPage>,
    );

    expect(screen.queryByRole("heading", { name: /جستجو و فیلتر/ })).toBeNull();
    // ListPagination returns null on a single page — the wrapper must not leave
    // a stray margin behind, which `empty:hidden` handles.
    const pager = container.querySelector(".mt-6");
    expect(pager).not.toBeNull();
    expect(pager).toBeEmptyDOMElement();
    expect(pager).toHaveClass("empty:hidden");
  });

  it("keeps a nested list under its own trail", () => {
    render(
      <AdminPage
        breadcrumb={[
          { label: "پنل مدیریت", href: "/admin" },
          { label: "ژورنال", href: "/admin/journal" },
        ]}
        title="دسته‌های ژورنال"
      >
        <p>محتوا</p>
      </AdminPage>,
    );

    expect(screen.getByRole("link", { name: "ژورنال" })).toHaveAttribute(
      "href",
      "/admin/journal",
    );
  });

  it("keeps standing copy in a dismissible help popover, not under the title", async () => {
    render(
      <AdminPage title="محصولات" description="توضیح ایستاده">
        <p>فهرست</p>
      </AdminPage>,
    );

    expect(screen.getByRole("heading", { name: "محصولات" })).toHaveClass(
      "text-xl",
    );
    expect(screen.queryByText("توضیح ایستاده")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "راهنمای صفحه" }));
    expect(await screen.findByText("توضیح ایستاده")).toBeVisible();
  });

  it("defaults list routes to the wide content column", () => {
    const onWidthChange = vi.fn();
    const { rerender } = render(
      <AdminContentWidthProvider onWidthChange={onWidthChange}>
        <AdminPage title="محصولات">
          <p>فهرست</p>
        </AdminPage>
      </AdminContentWidthProvider>,
    );
    expect(onWidthChange).toHaveBeenCalledWith("wide");

    onWidthChange.mockClear();
    rerender(
      <AdminContentWidthProvider onWidthChange={onWidthChange}>
        <AdminPage title="محصولات" width="default">
          <p>فهرست</p>
        </AdminPage>
      </AdminContentWidthProvider>,
    );
    expect(onWidthChange).toHaveBeenCalledWith("default");
  });
});
