"use client";

import * as React from "react";
import { Columns3, Rows3 } from "lucide-react";

import { EMPTY_TABLE, type TableGrid } from "@/components/admin/editor-nodes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { faNum } from "@/lib/products";

const MAX_ROWS = 20;
const MAX_COLUMNS = 8;

function resize(rows: string[][], rowCount: number, columnCount: number) {
  return Array.from({ length: rowCount }, (_, row) =>
    Array.from(
      { length: columnCount },
      (_, column) => rows[row]?.[column] ?? "",
    ),
  );
}

/** CE-4. Fills the grid a `simpleTable` node stores. */
export function TableDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: TableGrid;
  onSave: (grid: TableGrid) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-4 overflow-y-auto sm:max-w-3xl">
        {/* Radix unmounts this while closed, so the body re-seeds from the
            current node attributes on every open without an effect. */}
        <TableDialogBody
          initial={initial}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TableDialogBody({
  initial,
  onSave,
  onClose,
}: {
  initial?: TableGrid;
  onSave: (grid: TableGrid) => void;
  onClose: () => void;
}) {
  const [grid, setGrid] = React.useState<TableGrid>(
    initial?.rows?.length ? initial : EMPTY_TABLE,
  );

  const rowCount = grid.rows.length;
  const columnCount = grid.rows[0]?.length ?? 0;

  function setSize(rows: number, columns: number) {
    const nextRows = Math.min(Math.max(rows, 1), MAX_ROWS);
    const nextColumns = Math.min(Math.max(columns, 1), MAX_COLUMNS);
    setGrid((current) => ({
      ...current,
      rows: resize(current.rows, nextRows, nextColumns),
    }));
  }

  function setCell(row: number, column: number, value: string) {
    setGrid((current) => ({
      ...current,
      rows: current.rows.map((cells, rowIndex) =>
        rowIndex === row
          ? cells.map((cell, cellIndex) =>
              cellIndex === column ? value : cell,
            )
          : cells,
      ),
    }));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>جدول</DialogTitle>
        <DialogDescription>
          خانه‌ها متن ساده‌اند. سطر نخست می‌تواند سرستون باشد.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="table-rows">
            <Rows3 className="size-3.5" aria-hidden /> سطرها
          </Label>
          <Input
            id="table-rows"
            type="number"
            min={1}
            max={MAX_ROWS}
            dir="ltr"
            className="mt-1.5 w-24"
            value={rowCount}
            onChange={(event) =>
              setSize(Number(event.target.value) || 1, columnCount)
            }
          />
        </div>
        <div>
          <Label htmlFor="table-columns">
            <Columns3 className="size-3.5" aria-hidden /> ستون‌ها
          </Label>
          <Input
            id="table-columns"
            type="number"
            min={1}
            max={MAX_COLUMNS}
            dir="ltr"
            className="mt-1.5 w-24"
            value={columnCount}
            onChange={(event) =>
              setSize(rowCount, Number(event.target.value) || 1)
            }
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="table-header"
            checked={grid.header}
            onCheckedChange={(header) =>
              setGrid((current) => ({ ...current, header }))
            }
          />
          <Label htmlFor="table-header">سطر نخست سرستون است</Label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {grid.rows.map((cells, row) => (
              <tr key={row}>
                {cells.map((cell, column) => (
                  <td key={column} className="p-0.5">
                    <Input
                      className="h-9"
                      value={cell}
                      aria-label={`سطر ${faNum(row + 1)} ستون ${faNum(column + 1)}`}
                      onChange={(event) =>
                        setCell(row, column, event.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          انصراف
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSave(grid);
            onClose();
          }}
        >
          درج جدول
        </Button>
      </DialogFooter>
    </>
  );
}
