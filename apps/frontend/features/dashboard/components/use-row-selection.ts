"use client";

import * as React from "react";

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Row selection for an admin list (CF-18). Any list that can hand over the rows
 * it is showing plus a stable key per row can adopt it.
 *
 * Two rules are baked in because both have already bitten this codebase:
 *
 *   - The key is the row's identity, never its index (PE-1). A re-sort, a
 *     removed row or a rebased list must not slide the selection onto the
 *     neighbouring row.
 *   - The selection is scoped to the rows on screen. A filter or a page change
 *     rewrites the URL (S-3), the server list re-renders with a different set
 *     of rows, and this client component survives that soft navigation — so the
 *     selection is dropped the moment the row set changes. Acting later on rows
 *     the operator can no longer see is the hazard, and a selection that
 *     quietly spans pages is how it happens.
 */
export function useRowSelection<T>(rows: T[], getKey: (row: T) => string) {
  // Which rows are on screen, not what order they are in: a re-sort or a
  // refresh that returns the same rows must leave the selection alone.
  const scope = rows.map(getKey).sort().join(" ");
  const [scopedTo, setScopedTo] = React.useState(scope);
  const [selected, setSelected] = React.useState(EMPTY);

  // Adjusted during render rather than in an effect: an effect would let one
  // paint through carrying a count for rows that are already gone, and the
  // retry-the-failures flow depends on a cleared selection never resurrecting.
  if (scopedTo !== scope) {
    setScopedTo(scope);
    setSelected(EMPTY);
  }

  const selectedRows = React.useMemo(
    () => rows.filter((row) => selected.has(getKey(row))),
    [rows, getKey, selected],
  );

  const toggle = React.useCallback((key: string, next: boolean) => {
    setSelected((current) => {
      const draft = new Set(current);
      if (next) draft.add(key);
      else draft.delete(key);
      return draft;
    });
  }, []);

  const toggleAll = React.useCallback(
    (next: boolean) => setSelected(next ? new Set(rows.map(getKey)) : EMPTY),
    [rows, getKey],
  );

  /** Narrows the selection — used to leave only the rows a batch failed on. */
  const keepOnly = React.useCallback((keys: readonly string[]) => {
    setSelected(keys.length === 0 ? EMPTY : new Set(keys));
  }, []);

  return {
    selectedRows,
    allSelected: rows.length > 0 && selectedRows.length === rows.length,
    isSelected: (key: string) => selected.has(key),
    toggle,
    toggleAll,
    keepOnly,
  };
}
