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
import type {
  ImageUploaderHandle,
  UploadedImage,
} from "@/features/image-uploader/types";
import {
  heroDateTimeInputValue,
  heroDateTimeISO,
  heroSlideFormSchema,
  type HeroSlideFormValues,
} from "@/features/hero-slides/validations";
import { parseAsciiNumber } from "@/lib/normalize-digits";
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
    starts_at: heroDateTimeInputValue(slide?.starts_at),
    ends_at: heroDateTimeInputValue(slide?.ends_at),
    theme: slide?.theme ?? "dark",
    sort_order: slide?.sort_order != null ? String(slide.sort_order) : "0",
    is_active: slide?.is_active ?? true,
    desktop_file_staged: false,
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
  starts_at: "starts_at",
  ends_at: "ends_at",
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
  const desktopMediaRef =
    React.useRef<ImageUploaderHandle<UploadedImage | null>>(null);
  const mobileMediaRef =
    React.useRef<ImageUploaderHandle<UploadedImage | null>>(null);
  const [desktopPreview, setDesktopPreview] = React.useState(
    slide?.image_url ?? "",
  );
  const [mobilePreview, setMobilePreview] = React.useState(
    slide?.mobile_image_url ?? "",
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HeroSlideFormValues>({
    resolver: zodResolver(heroSlideFormSchema),
    defaultValues: defaults(slide),
  });

  // Live preview values.
  const title = watch("title");
  const eyebrow = watch("eyebrow");
  const subtitle = watch("subtitle");
  const badge = watch("badge");
  const ctaLabel = watch("cta_label");
  const ctaHref = watch("cta_href");
  const secondaryCtaLabel = watch("secondary_cta_label");
  const secondaryCtaHref = watch("secondary_cta_href");
  const imageAlt = watch("image_alt");
  const theme = watch("theme");
  const isActive = watch("is_active");
  const startsAt = watch("starts_at");
  const endsAt = watch("ends_at");

  function toPayload(v: HeroSlideFormValues): CreateHeroSlideInput {
    const startsAtUnchanged =
      mode === "edit" &&
      slide &&
      v.starts_at === heroDateTimeInputValue(slide.starts_at);
    const endsAtUnchanged =
      mode === "edit" &&
      slide &&
      v.ends_at === heroDateTimeInputValue(slide.ends_at);
    const sortOrder =
      v.sort_order.trim() === "" ? 0 : parseAsciiNumber(v.sort_order);
    const sortOrderUnchanged =
      mode === "edit" && slide && sortOrder === slide.sort_order;

    return {
      title: v.title.trim(),
      eyebrow: strOrNull(v.eyebrow),
      subtitle: strOrNull(v.subtitle),
      badge: strOrNull(v.badge),
      image_url: strOrNull(v.image_url),
      mobile_image_url: strOrNull(v.mobile_image_url),
      image_alt: strOrNull(v.image_alt),
      cta_label: strOrNull(v.cta_label),
      cta_href: strOrNull(v.cta_href),
      secondary_cta_label: strOrNull(v.secondary_cta_label),
      secondary_cta_href: strOrNull(v.secondary_cta_href),
      ...(startsAtUnchanged ? {} : { starts_at: heroDateTimeISO(v.starts_at) }),
      ...(endsAtUnchanged ? {} : { ends_at: heroDateTimeISO(v.ends_at) }),
      theme: v.theme,
      ...(sortOrderUnchanged ? {} : { sort_order: sortOrder }),
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
    } else if (e instanceof Error) {
      toast.error(e.message);
    } else {
      toast.error("خطای غیرمنتظره رخ داد");
    }
  }

  async function onSubmit(v: HeroSlideFormValues) {
    let savedOwnerId: number | null = null;
    try {
      const desktopMediaError = desktopMediaRef.current?.validate() ?? null;
      const mobileMediaError = mobileMediaRef.current?.validate() ?? null;
      if (desktopMediaError || mobileMediaError) {
        const field = desktopMediaError ? "image_url" : "mobile_image_url";
        setError(
          field,
          {
            message:
              desktopMediaError ?? mobileMediaError ?? "تصویر معتبر نیست",
          },
          { shouldFocus: true },
        );
        return;
      }
      const payload = toPayload(v);
      const desktopStaged = desktopMediaRef.current?.hasStaged ?? false;
      const mobileStaged = mobileMediaRef.current?.hasStaged ?? false;
      const needsMediaBeforeActivation =
        v.is_active && desktopStaged && !slide?.image_url;
      if (desktopStaged) {
        payload.image_url = mode === "create" ? null : undefined;
      }
      if (mobileStaged) {
        payload.mobile_image_url = mode === "create" ? null : undefined;
      }
      if (desktopStaged || mobileStaged) payload.image_alt = undefined;
      if (needsMediaBeforeActivation) payload.is_active = false;

      let saved: AdminHeroSlide;
      if (mode === "create") {
        saved = await createHeroSlide(payload);
      } else if (slide) {
        saved = await updateHeroSlide(slide.id, payload);
      } else {
        return;
      }
      savedOwnerId = saved.id;

      await desktopMediaRef.current?.flush(saved.id);
      await mobileMediaRef.current?.flush(saved.id);
      if (needsMediaBeforeActivation) {
        await updateHeroSlide(saved.id, { is_active: true });
      }
      toast.success(mode === "create" ? "اسلاید ایجاد شد" : "تغییرات ذخیره شد");
      router.push("/admin/hero-slides");
      router.refresh();
    } catch (e) {
      applyServerErrors(e);
      if (mode === "create" && savedOwnerId) {
        toast.info("پیش‌نویس ذخیره شد؛ بارگذاری را در صفحه ویرایش ادامه دهید");
        router.push(`/admin/hero-slides/${savedOwnerId}`);
        router.refresh();
      }
    }
  }

  const preview: HeroPreviewValues = {
    desktopImageUrl: desktopPreview,
    mobileImageUrl: mobilePreview,
    imageAlt,
    title,
    eyebrow,
    subtitle,
    badge,
    ctaLabel,
    ctaHref,
    secondaryCtaLabel,
    secondaryCtaHref,
    theme,
    isActive,
    startsAt,
    endsAt,
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid min-w-0 gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <HeroContentFields register={register} errors={errors} />
        <HeroResponsiveMediaFields
          control={control}
          errors={errors}
          ownerId={slide?.id}
          desktopRef={desktopMediaRef}
          mobileRef={mobileMediaRef}
          onDesktopStagedChange={(staged) =>
            setValue("desktop_file_staged", staged, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          onDesktopPreviewChange={setDesktopPreview}
          onMobilePreviewChange={setMobilePreview}
          imageAlt={imageAlt}
          disabled={isSubmitting}
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
        uploadBusy={isSubmitting}
        onCancel={() => router.push("/admin/hero-slides")}
      />
    </form>
  );
}
