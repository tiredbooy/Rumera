import { AlertTriangle } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { cn } from "@/lib/utils";
import { Field, Panel } from "./FormLayout";

export function MaintenanceSection({
  control,
  register,
  errors,
  maintenanceEnabled,
}: {
  control: Control<SiteSettingsFormValues>;
  register: UseFormRegister<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
  maintenanceEnabled: boolean;
}) {
  return (
    <TabsContent value="maintenance" forceMount className="mt-5 data-[state=inactive]:hidden">
      <Panel
        title="حالت تعمیر و نگهداری"
        description="با فعال‌سازی، فروشگاه برای بازدیدکنندگان قفل می‌شود."
      >
        <div className="sm:col-span-2">
          <div
            className={cn(
              "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition-colors",
              maintenanceEnabled
                ? "border-destructive/30 bg-destructive/10"
                : "border-border/60 bg-muted/20",
            )}
          >
            <div className="min-w-0">
              <Label htmlFor="enabled" className="text-sm font-medium">
                فعال‌سازی حالت تعمیر
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                در این حالت فروشگاه از دسترس عموم خارج می‌شود.
              </p>
            </div>
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  id="enabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label="فعال‌سازی حالت تعمیر و نگهداری"
                  className="cursor-pointer"
                />
              )}
            />
          </div>
        </div>

        {maintenanceEnabled ? (
          <div
            className="flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-destructive ring-1 ring-inset ring-destructive/20 sm:col-span-2"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs leading-relaxed">
              هشدار: با ذخیرهٔ این تنظیمات، فروشگاه بلافاصله برای بازدیدکنندگان
              غیرفعال می‌شود.
            </p>
          </div>
        ) : null}

        <Field
          id="message"
          label="پیام حالت تعمیر"
          error={errors.message?.message}
          hint="پیامی که هنگام تعمیر به بازدیدکنندگان نمایش داده می‌شود."
          full
        >
          <Textarea
            id="message"
            rows={3}
            placeholder="فروشگاه در حال به‌روزرسانی است؛ به‌زودی بازمی‌گردیم."
            {...register("message")}
          />
        </Field>
      </Panel>
    </TabsContent>
  );
}
