import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { Field, Panel } from "./FormLayout";

export function ShippingSection({
  register,
  errors,
  thresholdPreview,
}: {
  register: UseFormRegister<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
  thresholdPreview?: string;
}) {
  return (
    <TabsContent value="shipping" className="mt-5">
      <Panel
        title="قوانین ارسال"
        description="آستانهٔ ارسال رایگان و توضیحات ارسال."
      >
        <Field
          id="freeThreshold"
          label="آستانهٔ ارسال رایگان (تومان)"
          error={errors.freeThreshold?.message}
          hint={
            thresholdPreview ??
            "برای سفارش‌های بالای این مبلغ، ارسال رایگان است. صفر یعنی غیرفعال."
          }
        >
          <Input
            id="freeThreshold"
            type="text"
            dir="ltr"
            inputMode="numeric"
            placeholder="5000000"
            aria-invalid={!!errors.freeThreshold}
            {...register("freeThreshold")}
          />
        </Field>
        <Field
          id="note"
          label="توضیحات ارسال"
          error={errors.note?.message}
          full
        >
          <Textarea
            id="note"
            rows={3}
            placeholder="ارسال با بسته‌بندی ایمن و کنترل دما انجام می‌شود."
            {...register("note")}
          />
        </Field>
      </Panel>
    </TabsContent>
  );
}
