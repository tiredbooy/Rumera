"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import type {
  SiteSettings,
  UpdateSiteSettingsInput,
} from "@/features/settings/types";
import {
  siteSettingsFormSchema,
  type SiteSettingsFormValues,
} from "@/features/settings/validations";
import { faNum } from "@/lib/products";
import { ContactSection } from "./settings-form/ContactSection";
import { MaintenanceSection } from "./settings-form/MaintenanceSection";
import { SeoSection } from "./settings-form/SeoSection";
import { ShippingSection } from "./settings-form/ShippingSection";
import { SocialSection } from "./settings-form/SocialSection";
import { StoreSection } from "./settings-form/StoreSection";

// ── Validation ──────────────────────────────────────────────────────────────
// Every field is a string in the form (freeThreshold is a numeric string),
// coerced to the API shape on submit. The flat schema keys mirror the backend
// json names so the 422 `error.fields` map onto the inputs 1:1 via setError.

/** Backend json field name → flat form field. Used to map 422 errors onto inputs. */
const FIELD_KEYS = new Set<keyof SiteSettingsFormValues>([
  "name",
  "tagline",
  "logoUrl",
  "description",
  "supportEmail",
  "supportPhone",
  "address",
  "workingHours",
  "instagram",
  "telegram",
  "whatsapp",
  "twitter",
  "youtube",
  "linkedin",
  "freeThreshold",
  "note",
  "defaultTitle",
  "defaultDescription",
  "ogImage",
  "keywords",
  "enabled",
  "message",
]);

function defaults(s: SiteSettings): SiteSettingsFormValues {
  return {
    name: s.store.name ?? "",
    tagline: s.store.tagline ?? "",
    logoUrl: s.store.logoUrl ?? "",
    description: s.store.description ?? "",
    supportEmail: s.contact.supportEmail ?? "",
    supportPhone: s.contact.supportPhone ?? "",
    address: s.contact.address ?? "",
    workingHours: s.contact.workingHours ?? "",
    instagram: s.social.instagram ?? "",
    telegram: s.social.telegram ?? "",
    whatsapp: s.social.whatsapp ?? "",
    twitter: s.social.twitter ?? "",
    youtube: s.social.youtube ?? "",
    linkedin: s.social.linkedin ?? "",
    freeThreshold:
      s.shipping.freeThreshold != null ? String(s.shipping.freeThreshold) : "",
    note: s.shipping.note ?? "",
    defaultTitle: s.seo.defaultTitle ?? "",
    defaultDescription: s.seo.defaultDescription ?? "",
    ogImage: s.seo.ogImage ?? "",
    keywords: s.seo.keywords ?? "",
    enabled: s.maintenance.enabled ?? false,
    message: s.maintenance.message ?? "",
  };
}

/** Flat form values → the full wholesale-replace payload (every group, every field). */
function toPayload(v: SiteSettingsFormValues): UpdateSiteSettingsInput {
  return {
    store: {
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      logoUrl: v.logoUrl.trim(),
      description: v.description,
    },
    contact: {
      supportEmail: v.supportEmail.trim(),
      supportPhone: v.supportPhone.trim(),
      address: v.address,
      workingHours: v.workingHours.trim(),
    },
    social: {
      instagram: v.instagram.trim(),
      telegram: v.telegram.trim(),
      whatsapp: v.whatsapp.trim(),
      twitter: v.twitter.trim(),
      youtube: v.youtube.trim(),
      linkedin: v.linkedin.trim(),
    },
    shipping: {
      freeThreshold:
        v.freeThreshold.trim() === "" ? 0 : Number(v.freeThreshold),
      note: v.note,
    },
    seo: {
      defaultTitle: v.defaultTitle.trim(),
      defaultDescription: v.defaultDescription,
      ogImage: v.ogImage.trim(),
      keywords: v.keywords,
    },
    maintenance: {
      enabled: v.enabled,
      message: v.message,
    },
  };
}

const TABS = [
  { value: "store", label: "فروشگاه", icon: Store },
  { value: "contact", label: "تماس", icon: Phone },
  { value: "social", label: "شبکه‌ها", icon: Share2 },
  { value: "shipping", label: "ارسال", icon: Truck },
  { value: "seo", label: "سئو", icon: Search },
  { value: "maintenance", label: "تعمیر", icon: Wrench },
] as const;

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();

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
    defaultValues: defaults(settings),
  });

  const maintenanceEnabled = watch("enabled");
  const freeThreshold = watch("freeThreshold");
  const thresholdPreview =
    freeThreshold.trim() !== "" && /^\d+$/.test(freeThreshold.trim())
      ? `معادل ${faNum(Number(freeThreshold))} تومان`
      : undefined;

  function applyServerErrors(e: unknown) {
    if (e instanceof SettingsApiError) {
      if (e.fields) {
        Object.entries(e.fields)
          .filter(([key]) => FIELD_KEYS.has(key as keyof SiteSettingsFormValues))
          .forEach(([key, msgs], index) => {
            setError(
              key as keyof SiteSettingsFormValues,
              { message: msgs[0] },
              { shouldFocus: index === 0 },
            );
          });
      }
      toast.error(e.message || "ذخیرهٔ تنظیمات ناموفق بود.");
    } else {
      toast.error("خطای غیرمنتظره رخ داد.");
    }
  }

  async function onSubmit(v: SiteSettingsFormValues) {
    try {
      const updated = await updateSiteSettings(toPayload(v));
      toast.success("تنظیمات سایت ذخیره شد.");
      // Re-baseline the form to the server truth (clears the dirty state).
      reset(defaults(updated));
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
