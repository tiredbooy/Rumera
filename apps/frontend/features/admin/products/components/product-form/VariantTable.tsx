"use client";

import * as React from "react";
import { ArrowDownToLine, Sparkles, Wand2 } from "lucide-react";
import type {
  Control,
  FieldArrayWithId,
  UseFieldArrayRemove,
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminProductVariant,
  ProductOptionGroup,
} from "@/features/admin/products/types";
import type { InventoryItem } from "@/features/inventory/types";
import { generateVariantSkus, skuPrefix } from "../../variant-sku";
import type { ProductFormValues } from "../../validations";
import {
  VARIANT_CELL_COLUMNS,
  VariantRow,
  type VariantCellColumn,
} from "./VariantRow";

/** Columns a value can be pushed into in bulk. SKU is excluded on purpose: it
 *  must stay unique, so it gets the generator instead of a copied value. */
const BULK_COLUMNS = ["price", "compare_at_price", "is_active"] as const;
type BulkColumn = (typeof BULK_COLUMNS)[number];

const BULK_COLUMN_LABELS: Record<BulkColumn, string> = {
  price: "قیمت",
  compare_at_price: "قیمت پیش از تخفیف",
  is_active: "وضعیت",
};

const isBulkColumn = (value: string): value is BulkColumn =>
  (BULK_COLUMNS as readonly string[]).includes(value);

/**
 * Whether an arrow press at this control should leave the cell instead of
 * moving the caret. `direction` is -1 toward the start of the value.
 *
 * A range selection never escapes: the arrow collapses it first, which is what
 * a spreadsheet does and what an operator who just arrived on a pre-selected
 * cell expects.
 */
function canLeaveCell(element: Element, direction: -1 | 1) {
  if (!(element instanceof HTMLInputElement)) return true;
  if (element.value === "") return true;
  const { selectionStart, selectionEnd } = element;
  if (selectionStart === null || selectionEnd === null) return true;
  if (selectionStart !== selectionEnd) return false;
  return direction < 0
    ? selectionStart === 0
    : selectionStart === element.value.length;
}

export function VariantTable({
  register,
  control,
  setValue,
  getValues,
  fields,
  remove,
  optionTypes,
  productVariants = [],
  inventory = [],
  disabled,
  canAdjustStock = false,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  getValues: UseFormGetValues<ProductFormValues>;
  fields: FieldArrayWithId<ProductFormValues, "variants", "id">[];
  remove: UseFieldArrayRemove;
  optionTypes: ProductOptionGroup[];
  productVariants?: AdminProductVariant[];
  inventory?: InventoryItem[];
  disabled?: boolean;
  canAdjustStock?: boolean;
}) {
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);
  const inventoryByVariant = React.useMemo(
    () => new Map(inventory.map((row) => [row.product_variant_id, row])),
    [inventory],
  );
  // Selection is keyed by the field-array id, never by index: a delete shifts
  // every index below it, and PE-2's rebase resets the array outright. Ids that
  // no longer exist are dropped when the selection is read, so both cases
  // resolve themselves without a synchronising effect.
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The focused cell is mirrored into a ref because "fill down" reads it from
  // an event handler: a keystroke can land in the same tick as the focus that
  // preceded it, and the state copy is one render behind at that point.
  type ActiveCell = { row: number; column: VariantCellColumn };
  const activeCellRef = React.useRef<ActiveCell | null>(null);
  const [activeCell, setActiveCell] = React.useState<ActiveCell | null>(null);
  const [bulkColumn, setBulkColumn] = React.useState<BulkColumn>("price");
  const [bulkValue, setBulkValue] = React.useState("");
  const [bulkActive, setBulkActive] = React.useState("true");
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const selectedRows = React.useMemo(
    () =>
      fields.reduce<number[]>((rows, field, index) => {
        if (selectedIds.has(field.id)) rows.push(index);
        return rows;
      }, []),
    [fields, selectedIds],
  );
  const selectedCount = selectedRows.length;
  const allSelected = fields.length > 0 && selectedCount === fields.length;

  const toggleRow = React.useCallback((fieldId: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(fieldId);
      else next.delete(fieldId);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (selected: boolean) =>
      setSelectedIds(selected ? new Set(fields.map((f) => f.id)) : new Set()),
    [fields],
  );

  /**
   * Writes a batch of cells in one pass. Only the last write asks for
   * validation — the schema refines the whole product, so validating per row
   * would run the same resolver a hundred times for one identical answer.
   */
  const writeColumn = React.useCallback(
    (rows: number[], column: BulkColumn, value: string | boolean) => {
      rows.forEach((row, position) => {
        const options = {
          shouldDirty: true,
          shouldValidate: position === rows.length - 1,
        };
        if (column === "is_active") {
          setValue(`variants.${row}.is_active`, value === true, options);
        } else {
          setValue(`variants.${row}.${column}`, String(value), options);
        }
      });
    },
    [setValue],
  );

  function applyToSelected() {
    if (selectedRows.length === 0) return;
    const value =
      bulkColumn === "is_active" ? bulkActive === "true" : bulkValue;
    writeColumn(selectedRows, bulkColumn, value);
    setBulkOpen(false);
    setNotice(
      `«${BULK_COLUMN_LABELS[bulkColumn]}» روی ${selectedCount.toLocaleString("fa-IR")} تنوع اعمال شد.`,
    );
  }

  function fillDown() {
    const cell = activeCellRef.current;
    if (!cell || !isBulkColumn(cell.column)) return;
    const { row, column } = cell;
    const variants = getValues("variants") ?? [];
    const source = variants[row]?.[column];
    if (source === undefined) return;
    const below = variants
      .map((_, index) => index)
      .filter((index) => index > row);
    if (below.length === 0) return;
    writeColumn(below, column, source);
    setNotice(
      `مقدار «${BULK_COLUMN_LABELS[column]}» تنوع ${(row + 1).toLocaleString("fa-IR")} به ${below.length.toLocaleString("fa-IR")} ردیف پایین‌تر تکثیر شد.`,
    );
  }

  function generateSkus() {
    const code = getValues("code") ?? "";
    if (!skuPrefix(code)) {
      setNotice("برای ساخت خودکار SKU، ابتدا «کد محصول» را کامل کنید.");
      return;
    }
    const variants = getValues("variants") ?? [];
    const generated = generateVariantSkus(
      code,
      optionTypes,
      variants,
      selectedRows.length > 0 ? selectedRows : undefined,
    );
    if (generated.size === 0) {
      setNotice(
        "ردیف بدون SKU برای تکمیل پیدا نشد؛ SKUهای واردشده دست‌نخورده می‌مانند.",
      );
      return;
    }
    const rows = [...generated.keys()];
    rows.forEach((row, position) =>
      setValue(`variants.${row}.sku`, generated.get(row) as string, {
        shouldDirty: true,
        shouldValidate: position === rows.length - 1,
      }),
    );
    setNotice(
      `${generated.size.toLocaleString("fa-IR")} SKU ساخته شد؛ ردیف‌هایی که SKU داشتند تغییر نکردند.`,
    );
  }

  function focusCell(row: number, column: number, step: number) {
    if (row < 0 || row >= fields.length) return false;
    for (
      let index = column;
      index >= 0 && index < VARIANT_CELL_COLUMNS.length;
      index += step || 1
    ) {
      const target = bodyRef.current?.querySelector<HTMLElement>(
        `[data-cell="${row}:${index}"]`,
      );
      if (target) {
        target.focus();
        if (target instanceof HTMLInputElement) target.select();
        return true;
      }
      if (step === 0) return false;
    }
    return false;
  }

  function onCellKeyDown(event: React.KeyboardEvent<HTMLTableSectionElement>) {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-cell]",
    );
    if (!cell) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      fillDown();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const [row, column] = (cell.dataset.cell ?? "").split(":").map(Number);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return;

    // The grid reads right-to-left, so ArrowLeft advances to the next column.
    // The direction is the table's: the numeric cells are themselves dir="ltr"
    // so that digits group correctly, which says nothing about column order.
    const rtl =
      (
        cell.closest("table")?.getAttribute("dir") ||
        cell.ownerDocument.documentElement.dir
      ).toLowerCase() === "rtl";

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const next = row + (event.key === "ArrowDown" ? 1 : -1);
      if (focusCell(next, column, 0)) event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const caret = event.key === "ArrowLeft" ? -1 : 1;
      if (!canLeaveCell(cell, caret)) return;
      const step = (rtl ? -caret : caret) as -1 | 1;
      if (focusCell(row, column + step, step)) event.preventDefault();
    }
  }

  function onCellFocus(event: React.FocusEvent<HTMLTableSectionElement>) {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-cell]",
    );
    const [row, column] = (cell?.dataset.cell ?? "").split(":").map(Number);
    const name = VARIANT_CELL_COLUMNS[column];
    const next = name && Number.isInteger(row) ? { row, column: name } : null;
    activeCellRef.current = next;
    setActiveCell(next);
  }

  const canFillDown =
    !disabled &&
    activeCell !== null &&
    isBulkColumn(activeCell.column) &&
    activeCell.row < fields.length - 1;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {selectedCount > 0
            ? `${selectedCount.toLocaleString("fa-IR")} تنوع انتخاب شده`
            : "برای اعمال گروهی، ردیف‌ها را انتخاب کنید"}
        </p>

        <Popover open={bulkOpen} onOpenChange={setBulkOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || selectedCount === 0}
            >
              <Wand2 className="size-4" aria-hidden />
              اعمال روی انتخاب‌شده‌ها
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="variant-bulk-column">ستون</Label>
              <NativeSelect
                id="variant-bulk-column"
                className="w-full"
                value={bulkColumn}
                onChange={(event) => {
                  if (isBulkColumn(event.target.value)) {
                    setBulkColumn(event.target.value);
                  }
                }}
              >
                {BULK_COLUMNS.map((column) => (
                  <NativeSelectOption key={column} value={column}>
                    {BULK_COLUMN_LABELS[column]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="variant-bulk-value">مقدار</Label>
              {bulkColumn === "is_active" ? (
                <NativeSelect
                  id="variant-bulk-value"
                  className="w-full"
                  value={bulkActive}
                  onChange={(event) => setBulkActive(event.target.value)}
                >
                  <NativeSelectOption value="true">فعال</NativeSelectOption>
                  <NativeSelectOption value="false">غیرفعال</NativeSelectOption>
                </NativeSelect>
              ) : (
                <Input
                  id="variant-bulk-value"
                  inputMode="numeric"
                  dir="ltr"
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                />
              )}
            </div>

            <Button type="button" size="sm" onClick={applyToSelected}>
              اعمال بر {selectedCount.toLocaleString("fa-IR")} تنوع
            </Button>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canFillDown}
          onClick={fillDown}
        >
          <ArrowDownToLine className="size-4" aria-hidden />
          پر کردن به پایین
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || fields.length === 0}
          onClick={generateSkus}
        >
          <Sparkles className="size-4" aria-hidden />
          ساخت خودکار SKU
        </Button>
      </div>

      {notice ? (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <Table
        dir="rtl"
        containerClassName="rounded-xl border border-border/60"
        className="min-w-max"
      >
        <caption className="sr-only">
          جدول تنوع‌های محصول؛ ستون‌های ویژگی فقط خواندنی‌اند و بقیهٔ سلول‌ها با
          کلیدهای جهت‌دار قابل پیمایش‌اند.
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              {/* Deliberately boolean, not "indeterminate": the shared
                  Checkbox draws a tick for the mixed state, which would read as
                  "all selected". The count beside the toolbar carries that. */}
              <Checkbox
                checked={allSelected}
                disabled={disabled || fields.length === 0}
                aria-label="انتخاب همهٔ تنوع‌ها"
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </TableHead>
            <TableHead scope="col">تنوع</TableHead>
            {optionTypes.map((group) => (
              <TableHead key={group.id} scope="col">
                {group.display_name}
              </TableHead>
            ))}
            <TableHead scope="col">SKU</TableHead>
            <TableHead scope="col">قیمت (تومان)</TableHead>
            <TableHead scope="col">قیمت پیش از تخفیف</TableHead>
            <TableHead scope="col">موجودی</TableHead>
            <TableHead scope="col">وضعیت</TableHead>
            <TableHead scope="col">
              <span className="sr-only">عملیات</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody
          ref={bodyRef}
          onKeyDown={onCellKeyDown}
          onFocusCapture={onCellFocus}
        >
          {fields.map((field, index) => {
            const persisted = field._id
              ? productVariants.find((variant) => variant.id === field._id)
              : undefined;
            return (
              <VariantRow
                key={field.id}
                fieldId={field.id}
                index={index}
                register={register}
                control={control}
                setValue={setValue}
                optionTypes={optionTypes}
                images={persisted?.images}
                availableStock={persisted?.available_stock}
                inventory={
                  field._id ? inventoryByVariant.get(field._id) : undefined
                }
                variantId={field._id}
                isPersisted={Boolean(field._id)}
                selected={selectedIds.has(field.id)}
                disabled={disabled}
                canAdjustStock={canAdjustStock}
                onToggleSelect={toggleRow}
                onRemove={remove}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
