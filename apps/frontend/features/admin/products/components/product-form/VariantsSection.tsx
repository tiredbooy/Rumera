import { Layers, PackagePlus, Plus } from "lucide-react";
import type {
  FieldArrayWithId,
  FieldErrors,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import type { ProductFormValues } from "../../validations";
import { VariantRow } from "./VariantRow";

export function VariantsSection({
  register,
  errors,
  fields,
  append,
  remove,
}: {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  fields: FieldArrayWithId<ProductFormValues, "variants", "id">[];
  append: UseFieldArrayAppend<ProductFormValues, "variants">;
  remove: UseFieldArrayRemove;
}) {
  return (
    <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
      <legend className="flex items-center gap-2 px-1 font-serif text-base">
        <Layers className="size-4 text-muted-foreground" />
        قیمت‌گذاری و تنوع‌ها
      </legend>
      <p className="mt-1 text-xs text-muted-foreground">
        هر محصول می‌تواند چند تنوع (مثلاً حجم‌های مختلف) با قیمت جداگانه داشته
        باشد.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
            <PackagePlus className="size-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              هنوز تنوعی اضافه نشده است.
            </p>
          </div>
        ) : null}

        {fields.map((f, i) => (
          <VariantRow
            key={f.id}
            fieldId={f.id}
            index={i}
            register={register}
            errors={errors}
            onRemove={() => remove(i)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            append({
              sku: "",
              price: "",
              compare_at_price: "",
              option_value_ids: [],
            })
          }
        >
          <Plus className="size-4" /> افزودن تنوع
        </Button>
      </div>
    </fieldset>
  );
}
