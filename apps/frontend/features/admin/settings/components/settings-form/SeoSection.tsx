import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { Field, Panel } from "./FormLayout";

export function SeoSection({
  register,
  errors,
}: {
  register: UseFormRegister<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
}) {
  return (
    <TabsContent value="seo" forceMount className="mt-5 data-[state=inactive]:hidden">
      <Panel
        title="سئو و متادیتا"
        description="مقادیر پیش‌فرض صفحاتی که متادیتای اختصاصی ندارند."
      >
        <Field
          id="defaultTitle"
          label="عنوان پیش‌فرض"
          error={errors.defaultTitle?.message}
          full
        >
          <Input
            id="defaultTitle"
            aria-invalid={!!errors.defaultTitle}
            {...register("defaultTitle")}
          />
        </Field>
        <Field
          id="defaultDescription"
          label="توضیحات پیش‌فرض"
          error={errors.defaultDescription?.message}
          full
        >
          <Textarea
            id="defaultDescription"
            rows={3}
            {...register("defaultDescription")}
          />
        </Field>
        <Field
          id="ogImage"
          label="تصویر اشتراک‌گذاری (OG)"
          error={errors.ogImage?.message}
          hint="نشانی تصویر پیش‌فرض هنگام اشتراک‌گذاری لینک‌ها."
          full
        >
          <Input
            id="ogImage"
            dir="ltr"
            placeholder="https://…"
            aria-invalid={!!errors.ogImage}
            {...register("ogImage")}
          />
        </Field>
        <Field
          id="keywords"
          label="کلیدواژه‌ها"
          error={errors.keywords?.message}
          hint="کلیدواژه‌ها را با کاما جدا کنید."
          full
        >
          <Input
            id="keywords"
            placeholder="ویسکی، شراب، نوشیدنی"
            {...register("keywords")}
          />
        </Field>
      </Panel>
    </TabsContent>
  );
}
