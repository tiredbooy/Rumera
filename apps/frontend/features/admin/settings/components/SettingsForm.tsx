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
import { useForm } from "react-hook-form";
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
  toSettingsPayload,
} from "@/features/settings/form-utils";
import type { SiteSettings } from "@/features/settings/types";
import {
  siteSettingsFormSchema,
  type SiteSettingsFormValues,
} from "@/features/settings/validations";
import { faNum } from "@/lib/products";
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
  const initial = normalizeSiteSettings(settings);

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

  const maintenanceEnabled = watch("enabled");
  const freeThreshold = watch("freeThreshold");
  const thresholdPreview =
    freeThreshold.trim() !== "" && /^\d+$/.test(freeThreshold.trim())
      ? `معادل ${faNum(Number(freeThreshold))} تومان`
      : undefined;

  function applyServerErrors(e: unknown) {
    if (e instanceof SettingsApiError) {
      const mapped = mapSettingsFieldErrors(e.fields);
      Object.entries(mapped).forEach(([key, message], index) => {
        setError(
          key as keyof SiteSettingsFormValues,
          { message },
          { shouldFocus: index === 0 },
        );
      });
      toast.error(e.message || "ذخیرهٔ تنظیمات ناموفق بود.");
    } else {
      toast.error("خطای غیرمنتظره رخ داد.");
    }
  }

  async function onSubmit(v: SiteSettingsFormValues) {
    try {
      const updated = await updateSiteSettings(toSettingsPayload(v));
      const normalized = normalizeSiteSettings(updated);
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
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-testid="settings-form"
    >
      <Tabs defaultValue="store">
        <TabsList aria-label="بخش‌های تنظیمات" className="w-full">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 cursor-pointer px-3"
            >
              <Icon className="size-4" /> {label}
            </TabsTrigger>
          ))}
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
    </form>
  );
}
