"use client";

import * as React from "react";
import {
  ChevronDown,
  ImageIcon,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { ProductImage } from "@/features/catalog/products/types";
import { cn } from "@/lib/utils";
import type { ProductFormValues } from "../../validations";
import { VariantOptionSelectors } from "./VariantOptionSelectors";

function formatPrice(value?: string) {
  const price = Number(value);
  return price > 0 ? `${price.toLocaleString("fa-IR")} تومان` : "بدون قیمت";
}

export const VariantRow = React.memo(function VariantRow({
  index,
  fieldId,
  register,
  control,
  setValue,
  optionTypes,
  images,
  availableStock,
  isPersisted = false,
  defaultOpen = false,
  disabled,
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
  isPersisted?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  onRemove: UseFieldArrayRemove;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const sku = useWatch({ control, name: `variants.${index}.sku` });
  const price = useWatch({ control, name: `variants.${index}.price` });
  const selectedOptionIds =
    useWatch({ control, name: `variants.${index}.option_value_ids` }) ?? [];
  const { errors } = useFormState({
    control,
    name: `variants.${index}`,
  });
  const skuError = errors.variants?.[index]?.sku?.message;
  const priceError = errors.variants?.[index]?.price?.message;
  const compareError = errors.variants?.[index]?.compare_at_price?.message;
  const optionsError = errors.variants?.[index]?.option_value_ids?.message;
  const hasError = Boolean(
    skuError || priceError || compareError || optionsError,
  );
  const isOpen = open || hasError;
  const skuId = `variants.${index}.sku`;
  const priceId = `variants.${index}.price`;
  const compareId = `variants.${index}.compare_at_price`;
  const activeId = `variants.${index}.is_active`;
  const rowTitleId = `${fieldId}-title`;
  const selectedOptionLabels = optionTypes.flatMap((group) =>
    group.values
      .filter((value) => selectedOptionIds.includes(value.id))
      .map((value) => value.value),
  );
  const optionSummary =
    selectedOptionLabels.length > 0
      ? selectedOptionLabels.join(" / ")
      : "بدون ویژگی";
  const stockLabel =
    typeof availableStock === "number"
      ? availableStock > 0
        ? `موجودی: ${availableStock.toLocaleString("fa-IR")}`
        : "ناموجود"
      : isPersisted
        ? "موجودی نامشخص"
        : "موجودی پس از ایجاد";

  return (
    <>
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <div
        role="group"
        aria-labelledby={rowTitleId}
        className={cn(
          "min-w-0 overflow-hidden rounded-xl border border-border/60 bg-muted/20 transition-colors hover:border-border",
          hasError && "border-destructive/40",
        )}
      >
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 md:grid-cols-[minmax(0,1.4fr)_minmax(100px,.6fr)_minmax(130px,.7fr)_auto_auto]">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex min-w-0 items-center gap-2 rounded-lg text-start focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
            >
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span
                  id={rowTitleId}
                  className="block truncate text-sm font-medium"
                >
                  تنوع {index + 1}: {optionSummary}
                </span>
                <span
                  className="mt-0.5 block truncate text-xs text-muted-foreground"
                  dir="ltr"
                >
                  {sku?.trim() || "SKU تعیین نشده"}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5 md:hidden">
                  <Badge variant="outline">{formatPrice(price)}</Badge>
                  <Badge
                    variant={availableStock === 0 ? "destructive" : "secondary"}
                  >
                    {stockLabel}
                  </Badge>
                </span>
              </span>
            </button>
          </CollapsibleTrigger>

          <span className="hidden text-sm md:block">
            {formatPrice(price)}
          </span>
          <Badge
            variant={availableStock === 0 ? "destructive" : "secondary"}
            className="hidden md:inline-flex"
          >
            {stockLabel}
          </Badge>

          <Controller
            control={control}
            name={`variants.${index}.is_active`}
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Label htmlFor={activeId} className="sr-only">
                  فعال بودن تنوع {index + 1}
                </Label>
                <Switch
                  id={activeId}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                  aria-label={`فعال بودن تنوع ${index + 1}`}
                />
                <span className="hidden text-xs text-muted-foreground xl:inline">
                  {field.value ? "فعال" : "غیرفعال"}
                </span>
              </div>
            )}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`حذف تنوع ${index + 1}`}
            className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>

        <CollapsibleContent
          forceMount
          hidden={!isOpen}
          onFocusCapture={() => setOpen(true)}
        >
          <div className="border-t border-border/60 p-3 sm:p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
                <Label htmlFor={skuId} className="text-xs">
                  SKU
                </Label>
                <Input
                  id={skuId}
                  dir="ltr"
                  placeholder="مثلاً 750ML"
                  disabled={disabled}
                  aria-invalid={!!skuError}
                  aria-describedby={skuError ? fieldErrorId(skuId) : undefined}
                  {...register(`variants.${index}.sku`)}
                />
                {skuError ? (
                  <p
                    id={fieldErrorId(skuId)}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {skuError}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={priceId} className="text-xs">
                  قیمت (تومان)
                </Label>
                <Input
                  id={priceId}
                  type="number"
                  min={1}
                  dir="ltr"
                  disabled={disabled}
                  aria-invalid={!!priceError}
                  aria-describedby={
                    priceError ? fieldErrorId(priceId) : undefined
                  }
                  {...register(`variants.${index}.price`)}
                />
                {priceError ? (
                  <p
                    id={fieldErrorId(priceId)}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {priceError}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={compareId} className="text-xs">
                  قیمت پیش از تخفیف
                </Label>
                <Input
                  id={compareId}
                  type="number"
                  min={0}
                  dir="ltr"
                  disabled={disabled}
                  aria-invalid={!!compareError}
                  aria-describedby={
                    compareError ? fieldErrorId(compareId) : undefined
                  }
                  {...register(`variants.${index}.compare_at_price`)}
                />
                {compareError ? (
                  <p
                    id={fieldErrorId(compareId)}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {compareError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 border-t border-border/60 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <SlidersHorizontal
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  ویژگی‌های این تنوع
                </p>
                {images ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ImageIcon className="size-3.5" aria-hidden />
                    {images.length.toLocaleString("fa-IR")} تصویر اختصاصی
                  </p>
                ) : null}
              </div>
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
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
    <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف تنوع؟</AlertDialogTitle>
          <AlertDialogDescription>
            {sku?.trim()
              ? `تنوع «${sku.trim()}» از این محصول حذف می‌شود.`
              : `تنوع ${index + 1} از این محصول حذف می‌شود.`}
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
