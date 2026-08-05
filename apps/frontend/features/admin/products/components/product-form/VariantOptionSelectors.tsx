"use client";

import { useWatch } from "react-hook-form";
import type { Control, UseFormSetValue } from "react-hook-form";

import { fieldErrorId } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { ProductFormValues } from "../../validations";

const NO_OPTION = "__none__";

export function VariantOptionSelectors({
  index,
  control,
  setValue,
  optionTypes,
  error,
  disabled,
}: {
  index: number;
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  optionTypes: ProductOptionGroup[];
  error?: string;
  disabled?: boolean;
}) {
  const fieldName = `variants.${index}.option_value_ids` as const;
  const selectedIds = useWatch({ control, name: fieldName }) ?? [];
  const errorId = fieldErrorId(fieldName);

  if (optionTypes.length === 0) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">
          هنوز نوع ویژگی یا مقداری برای انتخاب تعریف نشده است.{" "}
          <a
            href="/admin/options"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            تعریف ویژگی مشترک
          </a>
        </p>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-2 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-describedby={error ? errorId : undefined}
      >
        {optionTypes.map((optionType, groupIndex) => {
          const groupValueIds = new Set(
            optionType.values.map((value) => value.id),
          );
          const selected = selectedIds.find((id) => groupValueIds.has(id));
          const selectId = `${fieldName}.type-${optionType.id}`;

          return (
            <div key={optionType.id} className="min-w-0 space-y-1.5">
              <Label htmlFor={selectId} className="text-xs">
                {optionType.display_name}
              </Label>
              <Select
                value={selected ? String(selected) : NO_OPTION}
                disabled={disabled || optionType.values.length === 0}
                onValueChange={(rawValue) => {
                  const next = selectedIds.filter(
                    (id) => !groupValueIds.has(id),
                  );
                  if (rawValue !== NO_OPTION) next.push(Number(rawValue));
                  setValue(fieldName, next, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              >
                <SelectTrigger
                  id={selectId}
                  className="h-11 w-full min-w-0 rounded-xl"
                  aria-invalid={!!error}
                  aria-describedby={error ? errorId : undefined}
                  data-field-path={groupIndex === 0 ? fieldName : undefined}
                >
                  <SelectValue placeholder="انتخاب نشده" />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value={NO_OPTION}>انتخاب نشده</SelectItem>
                  {optionType.values.map((value) => (
                    <SelectItem key={value.id} value={String(value.id)}>
                      {value.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {optionType.values.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  مقداری تعریف نشده است
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
