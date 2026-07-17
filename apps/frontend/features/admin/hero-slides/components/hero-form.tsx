"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  HeroSlideApiError,
  createHeroSlide,
  updateHeroSlide,
} from "@/features/hero-slides/api/client";
import type {
  AdminHeroSlide,
  CreateHeroSlideInput,
} from "@/features/hero-slides/types";
import {
  heroSlideFormSchema,
  type HeroSlideFormValues,
} from "@/features/hero-slides/validations";
import { HeroAppearanceFields } from "./hero-form/appearance-fields";
import { HeroContentFields } from "./hero-form/content-fields";
import { HeroCtaFields } from "./hero-form/cta-fields";
import {
  HeroPreviewPanel,
  type HeroPreviewValues,
} from "./hero-form/hero-preview";
import { HeroResponsiveMediaFields } from "./hero-form/responsive-media-fields";

// ── Validation (mirrors HeroSlideReq; strings coerced to the API shape on submit) ─

const strOrNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

function defaults(slide?: AdminHeroSlide): HeroSlideFormValues {
  return {
    title: slide?.title ?? "",
    eyebrow: slide?.eyebrow ?? "",
    subtitle: slide?.subtitle ?? "",
    badge: slide?.badge ?? "",
    image_url: slide?.image_url ?? "",
    mobile_image_url: slide?.mobile_image_url ?? "",
    image_alt: slide?.image_alt ?? "",
    cta_label: slide?.cta_label ?? "",
    cta_href: slide?.cta_href ?? "",
    secondary_cta_label: slide?.secondary_cta_label ?? "",
    secondary_cta_href: slide?.secondary_cta_href ?? "",
    theme: slide?.theme ?? "dark",
    sort_order: slide?.sort_order != null ? String(slide.sort_order) : "0",
    is_active: slide?.is_active ?? true,
  };
}

// Maps backend json keys → form field names so a 422 lands on the right input.
const FIELD_MAP: Record<string, keyof HeroSlideFormValues> = {
  title: "title",
  eyebrow: "eyebrow",
  subtitle: "subtitle",
  badge: "badge",
  image_url: "image_url",
  mobile_image_url: "mobile_image_url",
  image_alt: "image_alt",
  cta_label: "cta_label",
  cta_href: "cta_href",
  secondary_cta_label: "secondary_cta_label",
  secondary_cta_href: "secondary_cta_href",
  theme: "theme",
  sort_order: "sort_order",
  is_active: "is_active",
};

export function HeroForm({
  mode,
  slide,
  submitLabel = "ذخیره",
}: {
  mode: "create" | "edit";
  slide?: AdminHeroSlide;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [uploadsInFlight, setUploadsInFlight] = React.useState(0);
  const uploadBusy = uploadsInFlight > 0;

  function handleUploadingChange(uploading: boolean) {
    setUploadsInFlight((count) => Math.max(0, count + (uploading ? 1 : -1)));
  }

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HeroSlideFormValues>({
    resolver: zodResolver(heroSlideFormSchema),
    defaultValues: defaults(slide),
  });

  // Live preview values.
  const imageUrl = watch("image_url");
  const title = watch("title");
  const eyebrow = watch("eyebrow");
  const subtitle = watch("subtitle");
  const badge = watch("badge");
  const ctaLabel = watch("cta_label");
  const secondaryCtaLabel = watch("secondary_cta_label");
  const imageAlt = watch("image_alt");

  function toPayload(v: HeroSlideFormValues): CreateHeroSlideInput {
    return {
      title: v.title.trim(),
      eyebrow: strOrNull(v.eyebrow),
      subtitle: strOrNull(v.subtitle),
      badge: strOrNull(v.badge),
      image_url: v.image_url.trim(),
      mobile_image_url: strOrNull(v.mobile_image_url),
      image_alt: strOrNull(v.image_alt),
      cta_label: strOrNull(v.cta_label),
      cta_href: strOrNull(v.cta_href),
      secondary_cta_label: strOrNull(v.secondary_cta_label),
      secondary_cta_href: strOrNull(v.secondary_cta_href),
      theme: v.theme,
      sort_order: v.sort_order.trim() === "" ? 0 : Number(v.sort_order),
      is_active: v.is_active,
    };
  }

  function applyServerErrors(e: unknown) {
    if (e instanceof HeroSlideApiError) {
      if (e.fields) {
        Object.entries(e.fields)
          .flatMap(([key, msgs]) => {
            const field = FIELD_MAP[key];
            return field ? [[field, msgs[0]] as const] : [];
          })
          .forEach(([field, message], index) => {
            setError(field, { message }, { shouldFocus: index === 0 });
          });
      }
      toast.error(e.message);
    } else {
      toast.error("خطای غیرمنتظره رخ داد");
    }
  }

  async function onSubmit(v: HeroSlideFormValues) {
    try {
      const payload = toPayload(v);
      if (mode === "create") {
        await createHeroSlide(payload);
        toast.success("اسلاید ایجاد شد");
      } else if (slide) {
        await updateHeroSlide(slide.id, payload);
        toast.success("تغییرات ذخیره شد");
      }
      router.push("/admin/hero-slides");
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
    }
  }

  const dark = watch("theme") === "dark";
  const preview: HeroPreviewValues = {
    imageUrl,
    imageAlt,
    title,
    eyebrow,
    subtitle,
    badge,
    ctaLabel,
    secondaryCtaLabel,
    dark,
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]"
    >
      <div className="flex flex-col gap-6">
        <HeroContentFields register={register} errors={errors} />
        <HeroResponsiveMediaFields
          control={control}
          register={register}
          errors={errors}
          onUploadingChange={handleUploadingChange}
        />
        <HeroCtaFields register={register} errors={errors} />
        <HeroAppearanceFields
          control={control}
          register={register}
          errors={errors}
        />
      </div>

      <HeroPreviewPanel
        preview={preview}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        uploadBusy={uploadBusy}
        onCancel={() => router.push("/admin/hero-slides")}
      />
    </form>
  );
}
