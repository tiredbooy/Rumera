"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { faNum } from "@/lib/products";

import { LoyaltyApiError, updateLoyaltyProgramme } from "../api/client";
import {
  loyaltyProgrammeFormDefaults,
  loyaltyProgrammeFormSchema,
  TIER_ORDER,
  TIER_FA,
  toUpdateLoyaltyProgrammeInput,
  type LoyaltyProgrammeFormValues,
} from "../validations";
import type { LoyaltyProgramme } from "../types";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * L-1. Every commercial lever of the programme, editable.
 *
 * The backend has served these from `loyalty_programme` since PR-003f and has
 * accepted PUT the whole time; only the form was missing, so the screen kept
 * telling operators to edit `LOYALTY_*` and restart the API.
 */
export function LoyaltyProgrammeForm({
  programme,
}: {
  programme: LoyaltyProgramme;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LoyaltyProgrammeFormValues>({
    resolver: zodResolver(loyaltyProgrammeFormSchema),
    defaultValues: loyaltyProgrammeFormDefaults(programme),
  });

  async function onSubmit(values: LoyaltyProgrammeFormValues) {
    setFormError(null);
    try {
      // `enabled` is round-tripped, not edited here: the server validates it as
      // required, so dropping it would be a 422 on every save. The visible
      // kill-switch control is L-2.
      const saved = await updateLoyaltyProgramme(
        toUpdateLoyaltyProgrammeInput(values, programme.enabled),
      );
      toast.success("برنامهٔ باشگاه به‌روزرسانی شد");
      reset(loyaltyProgrammeFormDefaults(saved));
      router.refresh();
    } catch (error) {
      if (error instanceof LoyaltyApiError) {
        let focused = false;
        for (const [key, messages] of Object.entries(error.fields ?? {})) {
          setError(
            key as keyof LoyaltyProgrammeFormValues,
            { message: messages[0] },
            { shouldFocus: !focused },
          );
          focused = true;
        }
        setFormError(error.message);
        toast.error(error.message);
        return;
      }
      setFormError("ذخیرهٔ برنامهٔ باشگاه ناموفق بود");
      toast.error("ذخیرهٔ برنامهٔ باشگاه ناموفق بود");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mb-8 flex flex-col gap-6"
      aria-label="ویرایش برنامهٔ باشگاه"
    >
      {formError ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/20"
        >
          {formError}
        </p>
      ) : null}

      <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
        <legend className="px-1 font-serif text-base">نرخ‌ها</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="earn_divisor"
            label="مبلغ خرید به ازای هر امتیاز (تومان)"
            hint="هرچه بزرگ‌تر، امتیاز کمتر."
            error={errors.earn_divisor?.message}
          >
            <Input
              id="earn_divisor"
              inputMode="numeric"
              dir="ltr"
              {...register("earn_divisor")}
            />
          </Field>
          <Field
            id="redeem_value"
            label="ارزش هر امتیاز هنگام بازخرید (تومان)"
            error={errors.redeem_value?.message}
          >
            <Input
              id="redeem_value"
              inputMode="numeric"
              dir="ltr"
              {...register("redeem_value")}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
        <legend className="px-1 font-serif text-base">هدیه‌ها</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="signup_bonus"
            label="هدیهٔ عضویت (امتیاز)"
            error={errors.signup_bonus?.message}
          >
            <Input
              id="signup_bonus"
              inputMode="numeric"
              dir="ltr"
              {...register("signup_bonus")}
            />
          </Field>
          <Field
            id="review_bonus"
            label="هدیهٔ نظر تأییدشده (امتیاز)"
            error={errors.review_bonus?.message}
          >
            <Input
              id="review_bonus"
              inputMode="numeric"
              dir="ltr"
              {...register("review_bonus")}
            />
          </Field>
          <Field
            id="birthday_bonus"
            label="هدیهٔ تولد (امتیاز در سال)"
            error={errors.birthday_bonus?.message}
          >
            <Input
              id="birthday_bonus"
              inputMode="numeric"
              dir="ltr"
              {...register("birthday_bonus")}
            />
          </Field>
          <Field
            id="birthday_tz"
            label="منطقهٔ زمانی تولد"
            hint="نام IANA، مثلاً Asia/Tehran."
            error={errors.birthday_tz?.message}
          >
            <Input id="birthday_tz" dir="ltr" {...register("birthday_tz")} />
          </Field>
          <Field
            id="referral_reward"
            label="پاداش معرفی (امتیاز)"
            // Honest scope: referral payout still stamps the value the referral
            // service was constructed with, so this only affects new referrals.
            hint="فقط بر معرفی‌های تازه اثر دارد؛ معرفی‌های ثبت‌شده با مقدار زمان ثبت پرداخت می‌شوند."
            error={errors.referral_reward?.message}
          >
            <Input
              id="referral_reward"
              inputMode="numeric"
              dir="ltr"
              {...register("referral_reward")}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="border-hairline rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.04] sm:p-6">
        <legend className="px-1 font-serif text-base">آستانهٔ سطح‌ها</legend>
        <p className="mt-1 text-xs text-muted-foreground">
          بر پایهٔ امتیاز مادام‌العمر. «برنز» همیشه از صفر شروع می‌شود و هر سطح
          باید از سطح پیش از خود بزرگ‌تر باشد.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {TIER_ORDER.map((tier, index) => (
            <Field
              key={tier}
              id={`tier_${tier}`}
              label={TIER_FA[tier]}
              hint={index === 0 ? "ثابت روی ۰" : undefined}
              error={errors[`tier_${tier}` as keyof typeof errors]?.message}
            >
              <Input
                id={`tier_${tier}`}
                inputMode="numeric"
                dir="ltr"
                readOnly={index === 0}
                className={index === 0 ? "read-only:bg-muted" : undefined}
                {...register(`tier_${tier}` as keyof LoyaltyProgrammeFormValues)}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          ذخیرهٔ تغییرات
        </Button>
        {isDirty ? (
          <p className="text-xs text-muted-foreground">
            تغییرات ذخیره‌نشده دارید.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          تغییرات بلافاصله اعمال می‌شوند؛ نیازی به ری‌استارت نیست.
        </p>
      </div>

      <p className="sr-only">{faNum(programme.tiers.length)} سطح</p>
    </form>
  );
}
