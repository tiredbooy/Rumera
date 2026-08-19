"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Layers, PackagePlus, Plus } from "lucide-react";
import { useWatch } from "react-hook-form";
import type {
  FieldArrayWithId,
  Control,
  FieldErrors,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import type { ProductOptionGroup } from "@/features/admin/products/types";
import type { AdminProductVariant } from "@/features/admin/products/types";
import type { InventoryItem } from "@/features/inventory/types";
import type { ProductFormValues, VariantFormValues } from "../../validations";
import { generateVariantSkus } from "../../variant-sku";
import { BulkVariantGenerator } from "./BulkVariantGenerator";
import { FormSection } from "./FormLayout";
import { VariantTable } from "./VariantTable";

function WatchedBulkVariantGenerator({
  control,
  optionTypes,
  disabled,
  onGenerate,
}: {
  control: Control<ProductFormValues>;
  optionTypes: ProductOptionGroup[];
  disabled?: boolean;
  onGenerate: (generated: VariantFormValues[]) => void;
}) {
  const variants = useWatch({ control, name: "variants" }) ?? [];
  return (
    <BulkVariantGenerator
      optionTypes={optionTypes}
      existingCombinations={variants.map(
        (variant) => variant.option_value_ids ?? [],
      )}
      disabled={disabled}
      onGenerate={onGenerate}
    />
  );
}

export function VariantsSection({
  register,
  control,
  setValue,
  getValues,
  errors,
  fields,
  append,
  remove,
  optionTypes,
  optionCatalogError = null,
  productVariants = [],
  inventory = [],
  error,
  disabled,
  canAdjustStock = false,
}: {
  register: UseFormRegister<ProductFormValues>;
  control: Control<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  getValues: UseFormGetValues<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  fields: FieldArrayWithId<ProductFormValues, "variants", "id">[];
  append: UseFieldArrayAppend<ProductFormValues, "variants">;
  remove: UseFieldArrayRemove;
  optionTypes: ProductOptionGroup[];
  optionCatalogError?: string | null;
  productVariants?: AdminProductVariant[];
  inventory?: InventoryItem[];
  error?: string | null;
  disabled?: boolean;
  canAdjustStock?: boolean;
}) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  const hasError = Boolean(errors.variants || error || optionCatalogError);

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

        {optionCatalogError ? (
          <div
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/20"
          >
            <p>{optionCatalogError}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 h-10"
              disabled={isRetrying}
              onClick={() => startRetry(() => router.refresh())}
            >
              {isRetrying ? "در حال تلاش…" : "تلاش دوباره"}
            </Button>
          </div>
        ) : null}

        {optionTypes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4 text-sm leading-6">
            <p className="font-medium">هنوز ویژگی مشترکی تعریف نشده</p>
            <p className="mt-1 text-muted-foreground">
              یک‌بار «حجم»، «رنگ» و … را در بخش ویژگی‌ها بسازید؛ بعد همین‌جا
              برای هر محصول دوباره استفاده می‌کنید — نیازی به ساخت مجدد نیست.
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

        <WatchedBulkVariantGenerator
          control={control}
          optionTypes={optionTypes}
          disabled={disabled}
          onGenerate={(generated) => {
            // The complaint PE-1 answers is that a bulk run produced rows with
            // no SKU. Name them here, while the combination is still in hand.
            const existing = getValues("variants") ?? [];
            const offset = existing.length;
            const skus = generateVariantSkus(
              getValues("code") ?? "",
              optionTypes,
              [...existing, ...generated],
              generated.map((_, position) => offset + position),
            );
            append(
              generated.map((variant, position) => ({
                ...variant,
                sku: skus.get(offset + position) ?? variant.sku,
              })),
              { shouldFocus: false },
            );
          }}
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
          <VariantTable
            register={register}
            control={control}
            setValue={setValue}
            getValues={getValues}
            fields={fields}
            remove={remove}
            optionTypes={optionTypes}
            productVariants={productVariants}
            inventory={inventory}
            disabled={disabled}
            canAdjustStock={canAdjustStock}
          />
        ) : null}

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
