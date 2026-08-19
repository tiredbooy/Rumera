// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useRowSelection } from "./use-row-selection";

type Row = { id: number; title: string };

const page1: Row[] = [
  { id: 1, title: "الف" },
  { id: 2, title: "ب" },
  { id: 3, title: "ج" },
];
const page2: Row[] = [
  { id: 4, title: "د" },
  { id: 5, title: "ه" },
];

const key = (row: Row) => String(row.id);

function setup(rows: Row[] = page1) {
  return renderHook(({ current }: { current: Row[] }) =>
    useRowSelection(current, key),
    { initialProps: { current: rows } },
  );
}

afterEach(cleanup);

describe("useRowSelection", () => {
  it("selects by row identity, not position", () => {
    const { result, rerender } = setup();

    act(() => result.current.toggle("2", true));
    expect(result.current.selectedRows).toEqual([page1[1]]);

    // Same rows, re-sorted: the selection follows the row, not the index.
    rerender({ current: [page1[2], page1[1], page1[0]] });
    expect(result.current.selectedRows).toEqual([page1[1]]);
  });

  it("clears the selection when the row set changes under it", () => {
    const { result, rerender } = setup();

    act(() => result.current.toggleAll(true));
    expect(result.current.selectedRows).toHaveLength(3);
    expect(result.current.allSelected).toBe(true);

    // A filter or page change: different rows, nothing carried over.
    rerender({ current: page2 });
    expect(result.current.selectedRows).toEqual([]);
    expect(result.current.allSelected).toBe(false);

    // …and going back must not resurrect what was selected before.
    rerender({ current: page1 });
    expect(result.current.selectedRows).toEqual([]);
  });

  it("survives a refresh that returns the same rows with new data", () => {
    const { result, rerender } = setup();

    act(() => result.current.toggle("3", true));
    rerender({ current: page1.map((row) => ({ ...row, title: `${row.title}!` })) });

    expect(result.current.selectedRows).toEqual([{ id: 3, title: "ج!" }]);
  });

  it("narrows to the rows a batch failed on", () => {
    const { result } = setup();

    act(() => result.current.toggleAll(true));
    act(() => result.current.keepOnly(["1", "3"]));
    expect(result.current.selectedRows.map(key)).toEqual(["1", "3"]);

    act(() => result.current.keepOnly([]));
    expect(result.current.selectedRows).toEqual([]);
  });

  it("untoggles a single row without touching the rest", () => {
    const { result } = setup();

    act(() => result.current.toggleAll(true));
    act(() => result.current.toggle("2", false));
    expect(result.current.selectedRows.map(key)).toEqual(["1", "3"]);
    expect(result.current.isSelected("2")).toBe(false);
    expect(result.current.allSelected).toBe(false);
  });
});
