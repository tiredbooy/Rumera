"use client";

import Link from "next/link";
import { Layers, PackagePlus, Plus } from "lucide-react";
import { useWatch } from "react-hook-form";
import type {
  FieldArrayWithId,
  Control,
  FieldErrors,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { AdminProductVariant } from "@/features/admin/products/types";
import type { ProductFormValues } from "../../validations";
import { BulkVariantGenerator } from "./BulkVariantGenerator";
import { FormSection } from "./FormLayout";
import { VariantRow } from "./VariantRow";

export function VariantsSection({
  register,
  control,
  setValue,
  errors,
  fields,
  append,
  remove,
  optionTypes,
  productVariants = [],
  error,
  disabled,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  fields: FieldArrayWithId<ProductFormValues, "variants", "id">[];
  append: UseFieldArrayAppend<ProductFormValues, "variants">;
  remove: UseFieldArrayRemove;
  optionTypes: ProductOptionGroup[];
  productVariants?: AdminProductVariant[];
  error?: string | null;
  disabled?: boolean;
}) {
  const variants = useWatch({ control, name: "variants" }) ?? [];
  const hasError = Boolean(errors.variants || error);

  return (
    <FormSection
      sectionId="product-variants"
      title="قیمت‌گذاری و تنوع‌ها"
      description="هر ترکیب ویژگی به یک SKU و قیمت مستقل متصل می‌شود"
      icon={<Layers />}
      collapsible
      defaultOpen
      hasError={hasError}
      summary={`${fields.length.toLocaleString("fa-IR")} تنوع`}
    >
      <div className="flex flex-col gap-3 sm:col-span-2">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}

        {optionTypes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm leading-6">
            <p className="font-medium">هنوز ویژگی مشترکی تعریف نشده</p>
            <p className="mt-1 text-muted-foreground">
              یک‌بار «حجم»، «رنگ» و … را در بخش ویژگی‌ها بسازید؛ بعد همین‌جا برای
              هر محصول دوباره استفاده می‌کنید — نیازی به ساخت مجدد نیست.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3 h-10">
              <Link href="/admin/options">مدیریت ویژگی‌های تنوع</Link>
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            ویژگی‌های مشترک از{" "}
            <Link
              href="/admin/options"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              ویژگی‌های تنوع
            </Link>{" "}
            بارگذاری شده‌اند — برای هر SKU مقدار را انتخاب کنید.
          </p>
        )}

        <BulkVariantGenerator
          optionTypes={optionTypes}
          existingCombinations={variants.map(
            (variant) => variant.option_value_ids ?? [],
          )}
          disabled={disabled}
          onGenerate={(generated) => append(generated, { shouldFocus: false })}
        />

        {fields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
            <PackagePlus className="size-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              هنوز تنوعی اضافه نشده است.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 h-10"
              disabled={disabled}
              onClick={() =>
                append({
                  sku: "",
                  price: "",
                  compare_at_price: "",
                  is_active: true,
                  option_value_ids: [],
                })
              }
            >
              <Plus className="size-4" />
              افزودن اولین تنوع
            </Button>
          </div>
        ) : null}

        {fields.length > 0 ? (
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(100px,.6fr)_minmax(130px,.7fr)_auto_auto] gap-3 px-3 text-xs text-muted-foreground md:grid">
            <span>تنوع / SKU</span>
            <span>قیمت</span>
            <span>موجودی</span>
            <span>وضعیت</span>
            <span className="sr-only">عملیات</span>
          </div>
        ) : null}

        {fields.map((f, i) => (
          <VariantRow
            key={f.id}
            fieldId={f.id}
            index={i}
            register={register}
            control={control}
            setValue={setValue}
            errors={errors}
            optionTypes={optionTypes}
            images={
              f._id
                ? productVariants.find((variant) => variant.id === f._id)
                    ?.images
                : undefined
            }
            availableStock={
              f._id
                ? productVariants.find((variant) => variant.id === f._id)
                    ?.available_stock
                : undefined
            }
            isPersisted={Boolean(f._id)}
            defaultOpen={!f._id && fields.length <= 3}
            disabled={disabled}
            onRemove={() => remove(i)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled}
          onClick={() =>
            append(
              {
                sku: "",
                price: "",
                compare_at_price: "",
                is_active: true,
                option_value_ids: [],
              },
              { shouldFocus: false },
            )
          }
        >
          <Plus className="size-4" /> افزودن تنوع
        </Button>
      </div>
    </FormSection>
  );
}
