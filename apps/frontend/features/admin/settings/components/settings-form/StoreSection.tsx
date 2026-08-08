import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { Field, Panel } from "./FormLayout";

export function StoreSection({
  register,
  errors,
}: {
  register: UseFormRegister<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
}) {
  return (
    <TabsContent value="store" forceMount className="mt-5 data-[state=inactive]:hidden">
      <Panel title="اطلاعات فروشگاه" description="نام، شعار و معرفی فروشگاه.">
        <Field id="name" label="نام فروشگاه" error={errors.name?.message} full>
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
        </Field>
        <Field id="tagline" label="شعار" error={errors.tagline?.message} full>
          <Input
            id="tagline"
            aria-invalid={!!errors.tagline}
            {...register("tagline")}
          />
        </Field>
        <Field
          id="logoUrl"
          label="نشانی لوگو"
          error={errors.logoUrl?.message}
          hint="نشانی کامل تصویر لوگو."
          full
        >
          <Input
            id="logoUrl"
            dir="ltr"
            placeholder="https://…"
            aria-invalid={!!errors.logoUrl}
            {...register("logoUrl")}
          />
        </Field>
        <Field
          id="description"
          label="معرفی فروشگاه"
          error={errors.description?.message}
          full
        >
          <Textarea id="description" rows={4} {...register("description")} />
        </Field>
      </Panel>
    </TabsContent>
  );
}
