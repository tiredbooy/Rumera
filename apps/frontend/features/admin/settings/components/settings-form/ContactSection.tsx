import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { Field, Panel } from "./FormLayout";

export function ContactSection({
  register,
  errors,
}: {
  register: UseFormRegister<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
}) {
  return (
    <TabsContent value="contact" forceMount className="mt-5 data-[state=inactive]:hidden">
      <Panel
        title="اطلاعات تماس"
        description="راه‌های ارتباط مشتری با پشتیبانی."
      >
        <Field
          id="supportEmail"
          label="ایمیل پشتیبانی"
          error={errors.supportEmail?.message}
        >
          <Input
            id="supportEmail"
            type="email"
            dir="ltr"
            inputMode="email"
            placeholder="support@rumera.ir"
            aria-invalid={!!errors.supportEmail}
            {...register("supportEmail")}
          />
        </Field>
        <Field
          id="supportPhone"
          label="تلفن پشتیبانی"
          error={errors.supportPhone?.message}
        >
          <Input
            id="supportPhone"
            dir="ltr"
            inputMode="tel"
            placeholder="02191000000"
            aria-invalid={!!errors.supportPhone}
            {...register("supportPhone")}
          />
        </Field>
        <Field
          id="workingHours"
          label="ساعات کاری"
          error={errors.workingHours?.message}
        >
          <Input
            id="workingHours"
            placeholder="شنبه تا پنجشنبه، ۹ تا ۱۸"
            aria-invalid={!!errors.workingHours}
            {...register("workingHours")}
          />
        </Field>
        <Field id="address" label="نشانی" error={errors.address?.message} full>
          <Textarea id="address" rows={2} {...register("address")} />
        </Field>
      </Panel>
    </TabsContent>
  );
}
