"use client";

import * as React from "react";
import Link from "next/link";
import { ImageIcon, SlidersHorizontal, Trash2 } from "lucide-react";
import { Controller, useFormState, useWatch } from "react-hook-form";
import type {
  Control,
  UseFieldArrayRemove,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import { StockAdjustmentPopover } from "@/features/admin/inventory/components/stock-adjustment-popover";
import type { ProductImage } from "@/features/catalog/products/types";
import type { InventoryItem } from "@/features/inventory/types";
import { formatToman } from "@/lib/money";
import { toAsciiDigits } from "@/lib/normalize-digits";
import { cn } from "@/lib/utils";
import type { ProductFormValues } from "../../validations";
import { VariantOptionSelectors } from "./VariantOptionSelectors";

/**
 * The editable columns of the variant grid, in visual order (PE-1).
 *
 * Arrow-key traversal addresses a cell by `data-cell="<row>:<column index into
 * this list>"`, so the read-only option columns are deliberately absent: there
 * is nothing to land on in them.
 */
export const VARIANT_CELL_COLUMNS = [
  "select",
  "sku",
  "price",
  "compare_at_price",
  "is_active",
] as const;

export type VariantCellColumn = (typeof VARIANT_CELL_COLUMNS)[number];

export const cellIndex = (column: VariantCellColumn) =>
  VARIANT_CELL_COLUMNS.indexOf(column);

/** `data-cell` address of one editable cell. */
export const cellAddress = (row: number, column: VariantCellColumn) =>
  `${row}:${cellIndex(column)}`;

/**
 * The typed price echoed back grouped. A variant price is an exact decimal
 * string, so it goes through `formatToman`; `Number()` + `toLocaleString` used
 * to round it and disagree with every other screen showing the amount (D-2).
 */
function PriceEcho({ value }: { value?: string }) {
  const raw = toAsciiDigits(value ?? "").trim();
  if (raw === "" || !(Number(raw) > 0)) return null;
  return (
    <p className="mt-1 truncate text-xs text-muted-foreground">
      {formatToman(raw)}
    </p>
  );
}

function CellError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={fieldErrorId(id)}
      role="alert"
      className="mt-1 text-xs text-destructive"
    >
      {message}
    </p>
  );
}

/**
 * One row of the variant grid.
 *
 * Memoised and driven by `register`, so a keystroke in a cell re-renders
 * nothing: at 100 rows an inline editor that re-rendered the table per
 * character would be worse than the accordion it replaced.
 */
export const VariantRow = React.memo(function VariantRow({
  index,
  fieldId,
  register,
  control,
  setValue,
  optionTypes,
  images,
  availableStock,
  inventory,
  variantId,
  isPersisted = false,
  selected = false,
  disabled,
  canAdjustStock = false,
  onToggleSelect,
  onRemove,
}: {
  index: number;
  fieldId: string;
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  optionTypes: ProductOptionGroup[];
  images?: ProductImage[];
  availableStock?: number;
  /** Ledger row for this variant, present once it is persisted (PE-11). */
  inventory?: InventoryItem;
  variantId?: number;
  isPersisted?: boolean;
  selected?: boolean;
  disabled?: boolean;
  canAdjustStock?: boolean;
  onToggleSelect?: (fieldId: string, selected: boolean) => void;
  onRemove: UseFieldArrayRemove;
}) {
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const sku = useWatch({ control, name: `variants.${index}.sku` });
  const price = useWatch({ control, name: `variants.${index}.price` });
  const selectedOptionIds =
    useWatch({ control, name: `variants.${index}.option_value_ids` }) ?? [];
  const { errors } = useFormState({ control, name: `variants.${index}` });
  const skuError = errors.variants?.[index]?.sku?.message;
  const priceError = errors.variants?.[index]?.price?.message;
  const compareError = errors.variants?.[index]?.compare_at_price?.message;
  const optionsError = errors.variants?.[index]?.option_value_ids?.message;
  const hasError = Boolean(
    skuError || priceError || compareError || optionsError,
  );

  const rowNumber = index + 1;
  const rowHeaderId = `${fieldId}-row-header`;
  const optionsId = `variants.${index}.option_value_ids`;
  const skuId = `variants.${index}.sku`;
  const priceId = `variants.${index}.price`;
  const compareId = `variants.${index}.compare_at_price`;

  const stockLabel =
    typeof availableStock === "number"
      ? availableStock > 0
        ? availableStock.toLocaleString("fa-IR")
        : "ناموجود"
      : isPersisted
        ? "نامشخص"
        : "پس از ایجاد";

  return (
    <>
      <TableRow
        data-state={selected ? "selected" : undefined}
        className={cn(hasError && "bg-destructive/[0.06]")}
      >
        <TableCell className="w-10">
          <Checkbox
            checked={selected}
            disabled={disabled}
            aria-label={`انتخاب تنوع ${rowNumber}`}
            data-cell={cellAddress(index, "select")}
            onCheckedChange={(checked) =>
              onToggleSelect?.(fieldId, checked === true)
            }
          />
        </TableCell>

        <th
          scope="row"
          id={rowHeaderId}
          className="whitespace-nowrap p-2 text-start align-middle font-medium"
        >
          <span className="text-sm">تنوع {rowNumber}</span>
          {images?.length ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <ImageIcon className="size-3.5" aria-hidden />
              {images.length.toLocaleString("fa-IR")} تصویر اختصاصی
            </span>
          ) : null}
        </th>

        {optionTypes.map((group) => {
          const value = group.values.find((option) =>
            selectedOptionIds.includes(option.id),
          );
          return (
            <TableCell
              key={group.id}
              className={cn(
                "text-sm",
                value ? undefined : "text-muted-foreground",
                optionsError && "text-destructive",
              )}
            >
              {value?.value ?? "—"}
            </TableCell>
          );
        })}

        <TableCell className="min-w-40">
          <Input
            id={skuId}
            dir="ltr"
            className="font-mono"
            placeholder="مثلاً BLK-750ML"
            disabled={disabled}
            aria-label={`SKU تنوع ${rowNumber}`}
            aria-invalid={!!skuError}
            aria-describedby={skuError ? fieldErrorId(skuId) : undefined}
            data-cell={cellAddress(index, "sku")}
            {...register(`variants.${index}.sku`)}
          />
          <CellError id={skuId} message={skuError} />
        </TableCell>

        <TableCell className="min-w-32">
          <Input
            id={priceId}
            inputMode="numeric"
            dir="ltr"
            disabled={disabled}
            aria-label={`قیمت تنوع ${rowNumber} به تومان`}
            aria-invalid={!!priceError}
            aria-describedby={priceError ? fieldErrorId(priceId) : undefined}
            data-cell={cellAddress(index, "price")}
            {...register(`variants.${index}.price`)}
          />
          <CellError id={priceId} message={priceError} />
          {priceError ? null : <PriceEcho value={price} />}
        </TableCell>

        <TableCell className="min-w-32">
          <Input
            id={compareId}
            inputMode="numeric"
            dir="ltr"
            disabled={disabled}
            aria-label={`قیمت پیش از تخفیف تنوع ${rowNumber}`}
            aria-invalid={!!compareError}
            aria-describedby={
              compareError ? fieldErrorId(compareId) : undefined
            }
            data-cell={cellAddress(index, "compare_at_price")}
            {...register(`variants.${index}.compare_at_price`)}
          />
          <CellError id={compareId} message={compareError} />
        </TableCell>

        <TableCell
          className={cn(
            "text-sm tabular-nums",
            availableStock === 0 && "text-destructive",
          )}
        >
          {/* Stock is owned by the inventory ledger, not this aggregate. The
              save payload still has no stock field and never will: a level set
              through the product save would be an absolute overwrite with no
              movement behind it, erasing the audit trail and racing whatever
              orders committed stock since this page loaded. The adjustment
              below posts a signed movement to the inventory endpoint instead,
              with its own type and note (PE-11). */}
          <div className="flex items-center gap-1">
            {variantId ? (
              <Link
                href={`/admin/inventory/${variantId}`}
                className="underline-offset-4 hover:underline"
              >
                {stockLabel}
              </Link>
            ) : (
              <span className="text-muted-foreground">{stockLabel}</span>
            )}
            {inventory && canAdjustStock ? (
              <StockAdjustmentPopover inventory={inventory} compact />
            ) : null}
          </div>
        </TableCell>

        <TableCell className="w-16">
          <Controller
            control={control}
            name={`variants.${index}.is_active`}
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                aria-label={`فعال بودن تنوع ${rowNumber}`}
                data-cell={cellAddress(index, "is_active")}
              />
            )}
          />
        </TableCell>

        <TableCell className="w-24">
          <div className="flex items-center justify-end gap-0.5">
            <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={optionsId}
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={`ویرایش ویژگی‌های تنوع ${rowNumber}`}
                  aria-invalid={!!optionsError}
                  className={cn(
                    "size-11 text-muted-foreground",
                    optionsError && "text-destructive",
                  )}
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <VariantOptionSelectors
                  index={index}
                  control={control}
                  setValue={setValue}
                  optionTypes={optionTypes}
                  error={
                    typeof optionsError === "string" ? optionsError : undefined
                  }
                  disabled={disabled}
                />
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`حذف تنوع ${rowNumber}`}
              className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف تنوع؟</AlertDialogTitle>
            <AlertDialogDescription>
              {sku?.trim()
                ? `تنوع «${sku.trim()}» از این محصول حذف می‌شود.`
                : `تنوع ${rowNumber} از این محصول حذف می‌شود.`}
              {isPersisted
                ? " پس از ذخیره، این SKU از کاتالوگ هم برداشته می‌شود."
                : " هنوز ذخیره نشده و فقط از این فرم حذف می‌شود."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setRemoveOpen(false);
                onRemove(index);
              }}
            >
              حذف تنوع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
