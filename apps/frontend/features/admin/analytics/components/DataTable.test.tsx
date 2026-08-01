// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataTable, type Column } from "./DataTable";

type Row = { id: number; title: string; status: string };

afterEach(cleanup);

describe("DataTable row navigation", () => {
  it("renders the primary cell as a real link instead of a clickable row", () => {
    const rows: Row[] = [{ id: 7, title: "محصول اول", status: "فعال" }];
    const columns: Column<Row>[] = [
      { id: "title", header: "محصول", cell: (row) => row.title },
      { id: "status", header: "وضعیت", cell: (row) => row.status },
    ];

    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => String(row.id)}
        rowHref={(row) => `/admin/products/${row.id}`}
      />,
    );

    const link = screen.getByRole("link", { name: "محصول اول" });
    expect(link).toHaveAttribute("href", "/admin/products/7");
    expect(link.closest("tr")).not.toHaveAttribute("tabindex");
  });

  it("announces the active sort direction on its column header", () => {
    const rows: Row[] = [{ id: 7, title: "محصول اول", status: "فعال" }];
    const columns: Column<Row>[] = [
      {
        id: "title",
        header: "محصول",
        cell: (row) => row.title,
        sortValue: (row) => row.title,
      },
    ];
    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => String(row.id)}
      />,
    );

    const sortButton = screen.getByRole("button", { name: "محصول" });
    fireEvent.click(sortButton);
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(sortButton);
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "descending");
  });
});
