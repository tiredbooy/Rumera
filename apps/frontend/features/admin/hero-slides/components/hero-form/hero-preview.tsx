"use client";

import * as React from "react";
import {
  ArrowLeft,
  Loader2,
  Monitor,
  Moon,
  Smartphone,
  Sun,
} from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { HeroSlideFormValues } from "@/features/hero-slides/validations";
import { cn } from "@/lib/utils";
import {
  getHeroPublicationStatus,
  heroPublicationStatusLabel,
} from "../../publication-status";
import { usePublicationClock } from "../../use-publication-clock";

export type HeroPreviewValues = {
  desktopImageUrl: HeroSlideFormValues["image_url"];
  mobileImageUrl: HeroSlideFormValues["mobile_image_url"];
  imageAlt: HeroSlideFormValues["image_alt"];
  title: HeroSlideFormValues["title"];
  eyebrow: HeroSlideFormValues["eyebrow"];
  subtitle: HeroSlideFormValues["subtitle"];
  badge: HeroSlideFormValues["badge"];
  ctaLabel: HeroSlideFormValues["cta_label"];
  ctaHref: HeroSlideFormValues["cta_href"];
  secondaryCtaLabel: HeroSlideFormValues["secondary_cta_label"];
  secondaryCtaHref: HeroSlideFormValues["secondary_cta_href"];
  theme: HeroSlideFormValues["theme"];
  isActive: HeroSlideFormValues["is_active"];
  startsAt: HeroSlideFormValues["starts_at"];
  endsAt: HeroSlideFormValues["ends_at"];
};

type PreviewDevice = "desktop" | "mobile";

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
    desktopImageUrl,
    mobileImageUrl,
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
  } = preview;
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const publicationNow = usePublicationClock();
  const imageUrl =
    device === "mobile" ? mobileImageUrl || desktopImageUrl : desktopImageUrl;
  const lightText = theme === "dark";
  const primaryCtaVisible = Boolean(ctaLabel.trim() && ctaHref.trim());
  const secondaryCtaVisible = Boolean(
    secondaryCtaLabel.trim() && secondaryCtaHref.trim(),
  );
  const publicationStatus = getHeroPublicationStatus(
    {
      is_active: isActive,
      starts_at: startsAt,
      ends_at: endsAt,
    },
    publicationNow,
  );

  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <div className="lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-6">
        <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                پیش‌نمایش زنده
              </p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {heroPublicationStatusLabel[publicationStatus]}
              </span>
              <span className="text-muted-foreground" aria-hidden>
                {lightText ? (
                  <Moon className="size-3.5" />
                ) : (
                  <Sun className="size-3.5" />
                )}
              </span>
            </div>
            <ToggleGroup
              type="single"
              value={device}
              onValueChange={(value) => {
                if (value === "desktop" || value === "mobile") {
                  setDevice(value);
                }
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="اندازهٔ پیش‌نمایش"
            >
              <ToggleGroupItem value="desktop" aria-label="نمای دسکتاپ">
                <Monitor className="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="نمای موبایل">
                <Smartphone className="size-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div
            className={cn("bg-muted/30", device === "mobile" && "px-4 py-5")}
          >
            <div
              data-testid="hero-preview-frame"
              data-device={device}
              data-theme={theme}
              className={cn(
                "relative w-full overflow-hidden bg-muted",
                device === "desktop"
                  ? "aspect-[16/9]"
                  : "mx-auto aspect-[4/5] max-w-[240px] rounded-xl ring-1 ring-border/60",
              )}
            >
              <SmartImage
                key={`${device}:${imageUrl}`}
                src={imageUrl || null}
                alt={imageAlt || title || "پیش‌نمایش اسلاید"}
                sizes={device === "mobile" ? "240px" : "400px"}
                fallbackClassName="from-card via-card to-background"
              />
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-l",
                  lightText
                    ? "from-black/75 via-black/45 to-black/15"
                    : "from-white/85 via-white/55 to-white/10",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-t via-transparent",
                  lightText
                    ? "from-black/55 to-black/10"
                    : "from-white/55 to-white/10",
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 flex items-center",
                  device === "mobile" ? "p-4" : "p-5",
                )}
              >
                <div
                  className={cn(
                    "text-start",
                    device === "mobile" ? "max-w-full" : "max-w-[80%]",
                    lightText ? "text-white" : "text-stone-950",
                  )}
                >
                  {eyebrow || badge ? (
                    <p className="mb-2 inline-flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      {badge ? (
                        <Badge className="bg-gold text-gold-foreground">
                          {badge}
                        </Badge>
                      ) : null}
                      {eyebrow ? (
                        <span
                          className={
                            lightText ? "text-white/90" : "text-stone-800"
                          }
                        >
                          {eyebrow}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      "font-serif text-xl leading-tight",
                      lightText
                        ? "text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.5)]"
                        : "text-stone-950 [text-shadow:0_1px_16px_rgba(255,255,255,0.65)]",
                    )}
                  >
                    {title || "عنوان اسلاید"}
                  </p>
                  {subtitle ? (
                    <p
                      className={cn(
                        "mt-1.5 line-clamp-2 text-xs",
                        lightText ? "text-white/85" : "text-stone-800",
                      )}
                    >
                      {subtitle}
                    </p>
                  ) : null}
                  {primaryCtaVisible || secondaryCtaVisible ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {primaryCtaVisible ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                          {ctaLabel} <ArrowLeft className="size-3" />
                        </span>
                      ) : null}
                      {secondaryCtaVisible ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] backdrop-blur-md",
                            lightText
                              ? "border-white/40 bg-white/10 text-white"
                              : "border-black/25 bg-black/5 text-stone-950",
                          )}
                        >
                          {secondaryCtaLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <p className="px-4 py-2.5 text-center text-[11px] text-muted-foreground">
            {device === "mobile" && !mobileImageUrl
              ? "تصویر موبایل ثبت نشده؛ تصویر دسکتاپ نمایش داده می‌شود."
              : "نمای تقریبی از کاروسل صفحهٔ اصلی"}
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
