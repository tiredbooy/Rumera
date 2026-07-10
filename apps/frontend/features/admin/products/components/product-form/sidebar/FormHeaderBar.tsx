"use client"

import { Loader2 } from "lucide-react"
import { Controller, type Control } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ProductFormValues } from "../../../validations"

export function FormHeaderBar({
  mode,
  title,
  control,
  isSubmitting,
  onCancel,
}: {
  mode: "create" | "edit"
  title: string
  control: Control<ProductFormValues>
  isSubmitting: boolean
  onCancel: () => void
}) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
      <div className="min-w-0">
        <p className="truncate font-serif text-base leading-tight">
          {mode === "create" ? "افزودن محصول جدید" : title || "ویرایش محصول"}
        </p>
        <p className="text-xs text-muted-foreground">
          {mode === "create" ? "اطلاعات محصول را تکمیل کنید" : "تغییرات به‌صورت خودکار ذخیره نمی‌شوند"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {mode === "edit" ? (
          <div className="hidden items-center gap-2 border-e border-border/60 pe-3 sm:flex">
            <Label htmlFor="is_active_header" className="text-xs text-muted-foreground">
              انتشار
            </Label>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  id="is_active_header"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="وضعیت انتشار محصول"
                />
              )}
            />
          </div>
        ) : null}

        <Button type="button" variant="ghost" size="sm" disabled={isSubmitting} onClick={onCancel}>
          انصراف
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          ذخیره
        </Button>
      </div>
    </div>
  )
}