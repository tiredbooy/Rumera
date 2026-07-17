import { ArrowLeft, Loader2, Moon, Sun } from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";

export type HeroPreviewValues = {
  imageUrl: HeroSlideFormValues["image_url"];
  imageAlt: HeroSlideFormValues["image_alt"];
  title: HeroSlideFormValues["title"];
  eyebrow: HeroSlideFormValues["eyebrow"];
  subtitle: HeroSlideFormValues["subtitle"];
  badge: HeroSlideFormValues["badge"];
  ctaLabel: HeroSlideFormValues["cta_label"];
  secondaryCtaLabel: HeroSlideFormValues["secondary_cta_label"];
  dark: boolean;
};

export function HeroPreviewPanel({
  preview,
  submitLabel,
  isSubmitting,
  uploadBusy,
  onCancel,
}: {
  preview: HeroPreviewValues;
  submitLabel: string;
  isSubmitting: boolean;
  uploadBusy: boolean;
  onCancel: () => void;
}) {
  const {
    imageUrl,
    imageAlt,
    title,
    eyebrow,
    subtitle,
    badge,
    ctaLabel,
    secondaryCtaLabel,
    dark,
  } = preview;

  return (
    <aside className="flex flex-col gap-6">
      <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
        <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">
              پیش‌نمایش زنده
            </p>
            <span className="eyebrow text-xs text-muted-foreground">
              {dark ? (
                <Moon className="size-3.5" />
              ) : (
                <Sun className="size-3.5" />
              )}
            </span>
          </div>
          {/* Mimics the storefront hero proportions (16:9 desktop crop). */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
            <SmartImage
              src={imageUrl || null}
              alt={imageAlt || title || "پیش‌نمایش اسلاید"}
              sizes="400px"
              fallbackClassName="from-card via-card to-background"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/45 to-black/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
            <div className="absolute inset-0 flex items-center p-5">
              <div className="max-w-[80%] text-start text-white">
                {eyebrow || badge ? (
                  <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold text-primary-foreground">
                    {badge ? (
                      <Badge className="bg-gold text-gold-foreground">
                        {badge}
                      </Badge>
                    ) : null}
                    {eyebrow ? (
                      <span className="text-white/90">{eyebrow}</span>
                    ) : null}
                  </p>
                ) : null}
                <p className="font-serif text-xl leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.5)]">
                  {title || "عنوان اسلاید"}
                </p>
                {subtitle ? (
                  <p className="mt-1.5 line-clamp-2 text-xs text-white/85">
                    {subtitle}
                  </p>
                ) : null}
                {ctaLabel || secondaryCtaLabel ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {ctaLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                        {ctaLabel} <ArrowLeft className="size-3" />
                      </span>
                    ) : null}
                    {secondaryCtaLabel ? (
                      <span className="inline-flex items-center rounded-md border border-white/40 bg-white/10 px-2.5 py-1 text-[11px] text-white backdrop-blur-md">
                        {secondaryCtaLabel}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <p className="px-4 py-2.5 text-center text-[11px] text-muted-foreground">
            نمای تقریبی از کاروسل صفحهٔ اصلی
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={isSubmitting || uploadBusy}>
            {isSubmitting || uploadBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting || uploadBusy}
            onClick={onCancel}
          >
            انصراف
          </Button>
        </div>
      </div>
    </aside>
  );
}
