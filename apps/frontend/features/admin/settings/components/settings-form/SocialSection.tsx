import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import type { SiteSettingsFormValues } from "@/features/settings/validations";
import { Field, Panel } from "./FormLayout";

export function SocialSection({
  register,
  errors,
}: {
  register: UseFormRegister<SiteSettingsFormValues>;
  errors: FieldErrors<SiteSettingsFormValues>;
}) {
  return (
    <TabsContent value="social" className="mt-5">
      <Panel
        title="شبکه‌های اجتماعی"
        description="نشانی کامل صفحات. موارد خالی در فروشگاه نمایش داده نمی‌شوند."
      >
        <Field
          id="instagram"
          label="اینستاگرام"
          error={errors.instagram?.message}
        >
          <Input
            id="instagram"
            dir="ltr"
            placeholder="https://instagram.com/…"
            {...register("instagram")}
          />
        </Field>
        <Field id="telegram" label="تلگرام" error={errors.telegram?.message}>
          <Input
            id="telegram"
            dir="ltr"
            placeholder="https://t.me/…"
            {...register("telegram")}
          />
        </Field>
        <Field id="whatsapp" label="واتساپ" error={errors.whatsapp?.message}>
          <Input
            id="whatsapp"
            dir="ltr"
            placeholder="https://wa.me/…"
            {...register("whatsapp")}
          />
        </Field>
        <Field
          id="twitter"
          label="ایکس (توییتر)"
          error={errors.twitter?.message}
        >
          <Input
            id="twitter"
            dir="ltr"
            placeholder="https://x.com/…"
            {...register("twitter")}
          />
        </Field>
        <Field id="youtube" label="یوتیوب" error={errors.youtube?.message}>
          <Input
            id="youtube"
            dir="ltr"
            placeholder="https://youtube.com/…"
            {...register("youtube")}
          />
        </Field>
        <Field id="linkedin" label="لینکدین" error={errors.linkedin?.message}>
          <Input
            id="linkedin"
            dir="ltr"
            placeholder="https://linkedin.com/…"
            {...register("linkedin")}
          />
        </Field>
      </Panel>
    </TabsContent>
  );
}
