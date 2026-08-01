"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  FieldControl,
  fieldDescriptionId,
  fieldErrorId,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InventoryMutationError,
  useUpdateVariantReorder,
} from "@/features/inventory/hooks";
import type {
  InventoryItem,
  UpdateReorderThresholdInput,
} from "@/features/inventory/types";
import { faNum } from "@/lib/products";

import {
  reorderThresholdSchema,
  toReorderThresholdInput,
  type ReorderThresholdValues,
} from "../validations";

const FORM_FIELDS = new Set<keyof ReorderThresholdValues>([
  "reorder_point",
  "reorder_quantity",
]);

export function ReorderThresholdForm({
  inventory,
}: {
  inventory: InventoryItem;
}) {
  const router = useRouter();
  const update = useUpdateVariantReorder();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState({
    point: inventory.reorder_point,
    quantity: inventory.reorder_quantity,
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ReorderThresholdValues>({
    resolver: zodResolver(reorderThresholdSchema),
    defaultValues: {
      reorder_point: String(inventory.reorder_point),
      reorder_quantity: String(inventory.reorder_quantity),
    },
  });
  const busy = isSubmitting || update.isPending;

  async function submit(values: ReorderThresholdValues) {
    setFormError(null);
    const valuesInput = toReorderThresholdInput(values);
    const input: UpdateReorderThresholdInput = {};
    if (valuesInput.reorder_point !== confirmed.point) {
      input.reorder_point = valuesInput.reorder_point;
    }
    if (valuesInput.reorder_quantity !== confirmed.quantity) {
      input.reorder_quantity = valuesInput.reorder_quantity;
    }
    if (Object.keys(input).length === 0) {
      toast.info("مقادیر آستانه تغییری نکرده‌اند");
      return;
    }

    try {
      const updated = await update.mutateAsync({
        variantID: inventory.product_variant_id,
        input,
      });
      setConfirmed({
        point: updated.reorder_point,
        quantity: updated.reorder_quantity,
      });
      reset({
        reorder_point: String(updated.reorder_point),
        reorder_quantity: String(updated.reorder_quantity),
      });
      toast.success(
        `آستانهٔ ${faNum(updated.reorder_point)} و سفارش پیشنهادی ${faNum(updated.reorder_quantity)} ثبت شد`,
      );
      router.refresh();
    } catch (error) {
      if (error instanceof InventoryMutationError) {
        let firstInvalidField: keyof ReorderThresholdValues | undefined;
        for (const [key, messages] of Object.entries(error.fields ?? {})) {
          if (!FORM_FIELDS.has(key as keyof ReorderThresholdValues)) continue;
          const field = key as keyof ReorderThresholdValues;
          setError(field, { message: messages[0] });
          firstInvalidField ??= field;
        }
        if (firstInvalidField) setFocus(firstInvalidField);
        setFormError(
          error.code === "NOT_FOUND"
            ? "رکورد موجودی این واریانت پیدا نشد"
            : "ذخیرهٔ آستانه‌های سفارش ناموفق بود",
        );
      } else {
        setFormError("ذخیرهٔ آستانه‌های سفارش ناموفق بود");
      }
      toast.error("آستانه‌های سفارش ذخیره نشد");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="space-y-5"
      aria-busy={busy || undefined}
      noValidate
    >
      <div
        aria-live="polite"
        className="text-xs leading-5 text-muted-foreground"
      >
        مقدار تأییدشده: آستانه {faNum(confirmed.point)}، سفارش پیشنهادی{" "}
        {faNum(confirmed.quantity)} واحد.
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reorder_point">آستانهٔ سفارش</Label>
        <FieldControl
          id="reorder_point"
          error={errors.reorder_point?.message}
          description
        >
          <Input
            id="reorder_point"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            className="h-11"
            disabled={busy}
            {...register("reorder_point")}
          />
        </FieldControl>
        {errors.reorder_point?.message ? (
          <p
            id={fieldErrorId("reorder_point")}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.reorder_point.message}
          </p>
        ) : (
          <p
            id={fieldDescriptionId("reorder_point")}
            className="text-xs leading-5 text-muted-foreground"
          >
            وقتی موجودی قابل فروش به این مقدار برسد، وضعیت کمبود فعال می‌شود.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reorder_quantity">مقدار پیشنهادی سفارش</Label>
        <FieldControl
          id="reorder_quantity"
          error={errors.reorder_quantity?.message}
          description
        >
          <Input
            id="reorder_quantity"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            className="h-11"
            disabled={busy}
            {...register("reorder_quantity")}
          />
        </FieldControl>
        {errors.reorder_quantity?.message ? (
          <p
            id={fieldErrorId("reorder_quantity")}
            role="alert"
            className="text-xs text-destructive"
          >
            {errors.reorder_quantity.message}
          </p>
        ) : (
          <p
            id={fieldDescriptionId("reorder_quantity")}
            className="text-xs leading-5 text-muted-foreground"
          >
            این مقدار فقط راهنمای تأمین است و سفارش خودکار ایجاد نمی‌کند.
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {busy ? "در حال ذخیره…" : "ذخیرهٔ آستانه‌ها"}
      </Button>
    </form>
  );
}
