"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, Copy, Loader2 } from "lucide-react";
import { Controller, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProductFormValues } from "../../../validations";
import {
  productSaveAction,
  productSaveStatus,
  type ProductSavePhase,
} from "./save-status";

export function FormHeaderBar({
  mode,
  title,
  control,
  isSubmitting,
  isLocked,
  hasPendingRetry,
  savePhase,
  hasUnsavedChanges,
  canWrite = true,
  duplicateHref,
  onCancel,
}: {
  mode: "create" | "edit";
  title: string;
  control: Control<ProductFormValues>;
  isSubmitting: boolean;
  isLocked: boolean;
  hasPendingRetry: boolean;
  savePhase: ProductSavePhase;
  hasUnsavedChanges: boolean;
  canWrite?: boolean;
  duplicateHref?: string;
  onCancel: () => void;
}) {
  const status = productSaveStatus(savePhase, mode, hasUnsavedChanges);

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
      <div className="min-w-0">
        <p className="truncate font-serif text-base leading-tight">
          {mode === "create" ? "افزودن محصول جدید" : title || "ویرایش محصول"}
        </p>
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {savePhase === "saved" ? (
            <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
          ) : savePhase === "error" ||
            savePhase === "conflict" ||
            savePhase === "recoverable" ? (
            <CircleAlert className="size-3.5 text-destructive" aria-hidden />
          ) : null}
          {status}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        <div className="hidden items-center gap-2 border-e border-border/60 pe-3 sm:flex">
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <>
                <Label
                  htmlFor="is_active_header"
                  className="text-xs text-muted-foreground"
                >
                  {field.value ? "منتشر" : "پیش‌نویس"}
                </Label>
                <Switch
                  id="is_active_header"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isLocked || !canWrite}
                  aria-label="وضعیت انتشار محصول"
                />
              </>
            )}
          />
        </div>

        {duplicateHref ? (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={duplicateHref}>
              <Copy className="size-4" aria-hidden />
              تکثیر
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          انصراف
        </Button>
        {canWrite ? (
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {productSaveAction(savePhase, hasPendingRetry)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
