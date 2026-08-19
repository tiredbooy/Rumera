"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Gift,
  Loader2,
  Phone,
  Search,
  Share2,
  Store,
  Truck,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SettingsApiError,
  updateSiteSettings,
} from "@/features/settings/api/client";
import {
  defaultsFromSettings,
  mapSettingsFieldErrors,
  normalizeSiteSettings,
} from "@/features/settings/form-utils";
import type { SiteSettings } from "@/features/settings/types";
import {
  siteSettingsFormSchema,
  type SiteSettingsFormValues,
} from "@/features/settings/validations";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";
import {
  firstSettingsTabWithErrors,
  settingsTabForField,
  settingsTabsWithErrors,
  type SettingsTab,
} from "../settings-tabs";
import {
  UnsavedChangesDialog,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { toAdminSettingsPutBody } from "../to-admin-settings-put";
import { ContactSection } from "./settings-form/ContactSection";
import { GiftSection } from "./settings-form/GiftSection";
import { MaintenanceSection } from "./settings-form/MaintenanceSection";
import { SeoSection } from "./settings-form/SeoSection";
import { ShippingSection } from "./settings-form/ShippingSection";
import { SocialSection } from "./settings-form/SocialSection";
import { StoreSection } from "./settings-form/StoreSection";

const TABS = [
  { value: "store", label: "فروشگاه", icon: Store },
  { value: "contact", label: "تماس", icon: Phone },
  { value: "social", label: "شبکه‌ها", icon: Share2 },
  { value: "shipping", label: "ارسال", icon: Truck },
  { value: "gift", label: "هدیه", icon: Gift },
  { value: "seo", label: "سئو", icon: Search },
  { value: "maintenance", label: "تعمیر", icon: Wrench },
] as const;

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>("store");
  const initial = normalizeSiteSettings(settings);
  const expectedUpdatedAtRef = useRef(initial.updatedAt);

  useEffect(() => {
    expectedUpdatedAtRef.current = settings.updatedAt ?? "";
  }, [settings.updatedAt]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SiteSettingsFormValues>({
    resolver: zodResolver(siteSettingsFormSchema),
    defaultValues: defaultsFromSettings(initial),
    // Keep values when tab panels unmount so phone/address edits are never dropped.
    shouldUnregister: false,
  });

  // Saving re-baselines the form instead of navigating, so the guard disarms
  // on its own once `reset` clears the dirty state.
  const guard = useUnsavedChangesGuard({
    enabled: isDirty,
    isSaving: isSubmitting,
  });

  const maintenanceEnabled = watch("enabled");
  const freeThreshold = watch("freeThreshold");
  const thresholdPreview =
    freeThreshold.trim() !== "" &&
    /^\d+$/.test(toAsciiDigits(freeThreshold).trim())
      ? `معادل ${faNum(parseAsciiNumber(freeThreshold))} تومان`
      : undefined;

  function revealTabForErrors(errs: FieldErrors<SiteSettingsFormValues>) {
    const next = firstSettingsTabWithErrors(errs);
    if (!next) return;
    setTab(next);
    const firstField = Object.keys(errs).find(
      (name) => settingsTabForField(name) === next,
    );
    if (!firstField) return;
    queueMicrotask(() => {
      const el =
        document.getElementById(firstField) ??
        document.querySelector<HTMLElement>(`[name="${firstField}"]`);
      el?.focus();
    });
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof SettingsApiError) {
      const mapped = mapSettingsFieldErrors(e.fields);
      const nextErrors = {} as FieldErrors<SiteSettingsFormValues>;
      Object.entries(mapped).forEach(([key, message], index) => {
        setError(
          key as keyof SiteSettingsFormValues,
          { message },
          { shouldFocus: index === 0 },
        );
        nextErrors[key as keyof SiteSettingsFormValues] = {
          type: "server",
          message,
        };
      });
      revealTabForErrors(nextErrors);
      toast.error(e.message || "ذخیرهٔ تنظیمات ناموفق بود.");
    } else {
      toast.error("خطای غیرمنتظره رخ داد.");
    }
  }

  async function onSubmit(v: SiteSettingsFormValues) {
    try {
      const updated = await updateSiteSettings(
        toAdminSettingsPutBody(v, expectedUpdatedAtRef.current),
      );
      const normalized = normalizeSiteSettings(updated);
      expectedUpdatedAtRef.current = normalized.updatedAt;
      toast.success("تنظیمات سایت ذخیره شد.");
      // Re-baseline the form to the server truth (clears the dirty state).
      reset(defaultsFromSettings(normalized));
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, revealTabForErrors)}
      noValidate
      data-testid="settings-form"
    >
      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as SettingsTab)}
      >
        <TabsList aria-label="بخش‌های تنظیمات" className="w-full">
          {TABS.map(({ value, label, icon: Icon }) => {
            const invalid = settingsTabsWithErrors(errors).has(value);
            return (
              <TabsTrigger
                key={value}
                value={value}
                data-invalid={invalid || undefined}
                aria-label={invalid ? `${label}، دارای خطا` : undefined}
                className={cn(
                  "shrink-0 cursor-pointer px-3",
                  invalid && "text-destructive data-active:text-destructive",
                )}
              >
                <Icon className="size-4" /> {label}
                {invalid ? (
                  <span
                    className="size-1.5 rounded-full bg-destructive"
                    aria-hidden
                  />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <StoreSection register={register} errors={errors} />
        <ContactSection register={register} errors={errors} />
        <SocialSection register={register} errors={errors} />
        <ShippingSection
          register={register}
          errors={errors}
          thresholdPreview={thresholdPreview}
        />
        <GiftSection register={register} control={control} errors={errors} />
        <SeoSection register={register} errors={errors} />
        <MaintenanceSection
          control={control}
          register={register}
          errors={errors}
          maintenanceEnabled={maintenanceEnabled}
        />
      </Tabs>

      <div className="mt-6 flex max-w-2xl flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || !isDirty}
          className="cursor-pointer"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          ذخیرهٔ تنظیمات
        </Button>
        {isDirty ? (
          <p className="text-xs text-muted-foreground">
            تغییرات ذخیره‌نشده دارید.
          </p>
        ) : null}
      </div>

      <UnsavedChangesDialog {...guard.dialogProps} />
    </form>
  );
}
