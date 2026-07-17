"use client";

import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldErrorId } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  VariantPicker,
  type VariantOption,
} from "@/features/admin/products/components/variant-picker";
import type { RecipeFormValues } from "@/features/recipes/validations";
import { faNum } from "@/lib/products";

export function ShoppableProductsSection({
  control,
  register,
  errors,
  setValue,
}: {
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  errors: FieldErrors<RecipeFormValues>;
  setValue: UseFormSetValue<RecipeFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "products",
  });

  return (
    <section className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <header className="mb-4">
        <h2 className="eyebrow">
          <ShoppingCart className="size-3.5" aria-hidden />
          فرآورده‌های فروختنی
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          فرآورده‌هایی از کاتالوگ که خواننده می‌تواند مستقیم از صفحهٔ دستور به
          سبد بیفزاید.
        </p>
      </header>
      <div className="flex flex-col gap-3">
        {fields.length === 0 ? (
          <p className="rounded-xl bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
            محصول فروختنی‌ای به این دستور پیوند داده نشده است.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {fields.map((f, i) => (
              <li
                key={f.id}
                className="grid items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border"
              >
                <div className="flex flex-col gap-1.5">
                  <Label id={`products.${i}.label`} className="text-xs">
                    فرآورده فروختنی
                  </Label>
                  <Controller
                    control={control}
                    name={`products.${i}.product_variant_id`}
                    render={({ field }) => (
                      <VariantPicker
                        value={field.value || null}
                        ariaLabelledBy={`products.${i}.label`}
                        invalid={!!errors.products?.[i]?.product_variant_id}
                        ariaDescribedBy={
                          errors.products?.[i]?.product_variant_id
                            ? fieldErrorId(
                                `products.${i}.product_variant_id`,
                              )
                            : undefined
                        }
                        initialLabel={
                          f._label
                            ? {
                                variantId: f.product_variant_id,
                                productTitle: f._label,
                                brand: f._brand ?? null,
                                sku: f._sku ?? null,
                                price: 0,
                              }
                            : null
                        }
                        onChange={(opt: VariantOption | null) => {
                          field.onChange(opt?.variantId ?? 0);
                          setValue(
                            `products.${i}._label`,
                            opt?.productTitle ?? "",
                          );
                          setValue(`products.${i}._brand`, opt?.brand ?? null);
                          setValue(`products.${i}._sku`, opt?.sku ?? null);
                        }}
                      />
                    )}
                  />
                  {errors.products?.[i]?.product_variant_id ? (
                    <p
                      id={fieldErrorId(`products.${i}.product_variant_id`)}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {errors.products[i]?.product_variant_id?.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor={`products.${i}.quantity`}
                      className="text-xs"
                    >
                      مقدار
                    </Label>
                    <Input
                      id={`products.${i}.quantity`}
                      dir="ltr"
                      placeholder="۱"
                      {...register(`products.${i}.quantity`)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`products.${i}.unit`} className="text-xs">
                      واحد
                    </Label>
                    <Input
                      id={`products.${i}.unit`}
                      placeholder="بطری"
                      {...register(`products.${i}.unit`)}
                    />
                  </div>
                  <div className="flex items-end gap-3 pb-0.5">
                    <div className="flex items-center gap-2">
                      <Controller
                        control={control}
                        name={`products.${i}.is_primary`}
                        render={({ field }) => (
                          <Switch
                            id={`products.${i}.is_primary`}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="فرآورده اصلی"
                          />
                        )}
                      />
                      <Label
                        htmlFor={`products.${i}.is_primary`}
                        className="text-xs font-normal"
                      >
                        اصلی
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`حذف فرآورده ${faNum(i + 1)}`}
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            append({
              product_variant_id: 0,
              _label: "",
              _brand: null,
              _sku: null,
              quantity: "",
              unit: "",
              is_primary: false,
            })
          }
        >
          <Plus className="size-4" /> پیوند فرآورده فروختنی
        </Button>
      </div>
    </section>
  );
}
