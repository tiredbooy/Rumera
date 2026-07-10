import { GripVertical, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductFormValues } from "../../validations";

export function VariantRow({
  index,
  fieldId,
  register,
  errors,
  onRemove,
}: {
  index: number;
  fieldId: string;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  onRemove: () => void;
}) {
  const priceError = errors.variants?.[index]?.price?.message;
  const compareError = errors.variants?.[index]?.compare_at_price?.message;

  return (
    <div
      key={fieldId}
      className="group grid grid-cols-[auto_1fr_1fr_1fr_auto] items-end gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border"
    >
      <span className="mb-2.5 hidden text-muted-foreground/50 sm:inline-flex">
        <GripVertical className="size-4" />
      </span>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`variants.${index}.sku`} className="text-xs">
          SKU
        </Label>
        <Input
          id={`variants.${index}.sku`}
          dir="ltr"
          placeholder="مثلاً 750ML"
          {...register(`variants.${index}.sku`)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`variants.${index}.price`} className="text-xs">
          قیمت (تومان)
        </Label>
        <Input
          id={`variants.${index}.price`}
          type="number"
          dir="ltr"
          aria-invalid={!!priceError}
          {...register(`variants.${index}.price`)}
        />
        {priceError ? (
          <p className="text-xs text-destructive">{priceError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={`variants.${index}.compare_at_price`}
          className="text-xs"
        >
          قیمت پیش از تخفیف
        </Label>
        <Input
          id={`variants.${index}.compare_at_price`}
          type="number"
          dir="ltr"
          aria-invalid={!!compareError}
          {...register(`variants.${index}.compare_at_price`)}
        />
        {compareError ? (
          <p className="text-xs text-destructive">{compareError}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="حذف تنوع"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
