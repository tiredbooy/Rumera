// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DataTable, type Column, type Filter } from "./DataTable";

type Row = { id: number; title: string; status: string };

afterEach(cleanup);

beforeEach(() => {
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(Element.prototype, "releasePointerCapture", {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
});

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

  it("reports only the rows a facet is still showing", async () => {
    const seen: string[][] = [];
    const rows: Row[] = [
      { id: 1, title: "الف", status: "فعال" },
      { id: 2, title: "ب", status: "آرشیو" },
    ];
    const columns: Column<Row>[] = [
      { id: "title", header: "محصول", cell: (row) => row.title },
    ];
    const filters: Filter<Row>[] = [
      {
        id: "status",
        label: "وضعیت",
        getValue: (row) => row.status,
        options: [
          { value: "فعال", label: "فعال" },
          { value: "آرشیو", label: "آرشیو" },
        ],
      },
    ];

    render(
      <DataTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => String(row.id)}
        filters={filters}
        onVisibleRowsChange={(visible) => {
          seen.push(visible.map((row) => row.title));
        }}
      />,
    );

    await waitFor(() => expect(seen.at(-1)).toEqual(["الف", "ب"]));

    const trigger = screen.getByRole("combobox", { name: /وضعیت/ });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "آرشیو" }));

    await waitFor(() => expect(seen.at(-1)).toEqual(["ب"]));
  });
});
