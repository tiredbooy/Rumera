"use client";

import { Loader2 } from "lucide-react";
import { Controller, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProductFormValues } from "../../../validations";
import { productSaveAction, type ProductSavePhase } from "./save-status";

export function MobileActionBar({
  control,
  isSubmitting,
  isLocked,
  hasPendingRetry,
  savePhase,
  onCancel,
}: {
  control: Control<ProductFormValues>;
  isSubmitting: boolean;
  isLocked: boolean;
  hasPendingRetry: boolean;
  savePhase: ProductSavePhase;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur sm:hidden">
      <div className="flex items-center justify-between gap-3">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Label
                htmlFor="is_active_mobile"
                className="text-xs text-muted-foreground"
              >
                {field.value ? "منتشر" : "پیش‌نویس"}
              </Label>
              <Switch
                id="is_active_mobile"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isLocked}
                aria-label="وضعیت انتشار محصول"
              />
            </div>
          )}
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            انصراف
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {productSaveAction(savePhase, hasPendingRetry)}
          </Button>
        </div>
      </div>
    </div>
  );
}
