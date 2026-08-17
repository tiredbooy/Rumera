"use client";

import * as React from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PublicHeroSlide } from "@/features/hero-slides/types";
import { HeroResponsiveImage } from "./hero-responsive-image";

const AUTOPLAY_MS = 6500;

/**
 * HeroCarousel — the storefront's dynamic, admin-managed hero slider.
 *
 * Full-bleed editorial slides backed by the `/hero-slides` API. Built on embla
 * (already a dependency) with a lightweight autoplay loop — no extra plugin — that
 * pauses on hover, focus and pointer interaction, and never runs for
 * `prefers-reduced-motion` users. RTL-aware. Responsive art direction uses the
 * mobile image when available and retains the branded missing-image fallback.
 *
 * Image spec (drop assets at the slide's image_url — see public/images/README):
 *   desktop  2400×1350  (16:9)   ·   mobile  1080×1350  (4:5)
 */
export function HeroCarousel({ slides }: { slides: PublicHeroSlide[] }) {
  const [emblaRef, embla] = useEmblaCarousel({
    loop: slides.length > 1,
    direction: "rtl",
    align: "start",
  });
  const [selected, setSelected] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [interacting, setInteracting] = React.useState(false);
  const [userPaused, setUserPaused] = React.useState(false);
  const dotScrollerRef = React.useRef<HTMLDivElement>(null);
  const dotRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const initialSelectionRef = React.useRef(true);
  const paused = userPaused || hovered || focused || interacting;
  const activeTheme = slides[selected]?.theme ?? "dark";
  const darkControls = activeTheme === "dark";

  const onSelect = React.useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
  }, [embla]);

  React.useEffect(() => {
    if (!embla) return;
    // `selected` starts at 0, which already matches the initial snap — so we
    // only need to subscribe; no synchronous setState in the effect body.
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla, onSelect]);

  React.useEffect(() => {
    if (initialSelectionRef.current) {
      initialSelectionRef.current = false;
      return;
    }
    const scroller = dotScrollerRef.current;
    const dot = dotRefs.current[selected];
    if (!scroller || !dot) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    const delta =
      dotRect.left < scrollerRect.left
        ? dotRect.left - scrollerRect.left
        : dotRect.right > scrollerRect.right
          ? dotRect.right - scrollerRect.right
          : 0;
    if (delta !== 0) scroller.scrollBy?.({ left: delta });
  }, [selected]);

  // Lightweight autoplay — honours reduced-motion and pauses on interaction.
  React.useEffect(() => {
    if (!embla || paused || slides.length < 2) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    const id = window.setInterval(() => embla.scrollNext(), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [embla, paused, slides.length]);

  React.useEffect(() => {
    if (!interacting) return;
    const finishInteraction = () => setInteracting(false);
    window.addEventListener("pointerup", finishInteraction);
    window.addEventListener("pointercancel", finishInteraction);
    return () => {
      window.removeEventListener("pointerup", finishInteraction);
      window.removeEventListener("pointercancel", finishInteraction);
    };
  }, [interacting]);

  if (slides.length === 0) return null;

  return (
    <section
      className="cellar-glow relative border-b border-border/60"
      data-theme={activeTheme}
      aria-roledescription="carousel"
      aria-label="پیشنهادهای ویژه"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onPointerDown={() => setInteracting(true)}
    >
      <div className="touch-pan-y overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, i) => (
            <HeroSlideView
              key={slide.id}
              slide={slide}
              priority={i === 0}
              active={i === selected}
              position={i + 1}
              total={slides.length}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      {slides.length > 1 ? (
        <>
          <div className="container-px pointer-events-none absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-7xl items-center justify-between gap-3">
            {/* Dots */}
            <div
              ref={dotScrollerRef}
              role="group"
              aria-label="انتخاب اسلاید"
              className="pointer-events-auto flex min-w-0 max-w-full items-center overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  ref={(node) => {
                    dotRefs.current[i] = node;
                  }}
                  type="button"
                  onClick={() => embla?.scrollTo(i)}
                  aria-label={`نمایش اسلاید ${i + 1}: ${slide.title}`}
                  aria-current={i === selected}
                  className={cn(
                    "group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-3",
                    darkControls
                      ? "focus-visible:bg-black/40 focus-visible:ring-white/90"
                      : "focus-visible:bg-white/60 focus-visible:ring-black/70",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                      darkControls
                        ? "bg-white/50 group-hover:bg-white/80"
                        : "bg-black/35 group-hover:bg-black/65",
                      i === selected
                        ? cn("w-8", darkControls ? "bg-white" : "bg-stone-950")
                        : "w-1.5",
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Arrows */}
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setUserPaused((value) => !value)}
                aria-label={userPaused ? "شروع پخش خودکار" : "توقف پخش خودکار"}
                aria-pressed={userPaused}
                className={cn(
                  "size-11 shrink-0 rounded-full backdrop-blur-md",
                  darkControls
                    ? "border-white/30 bg-black/20 text-white hover:bg-black/40 hover:text-white focus-visible:border-white focus-visible:ring-white/80"
                    : "border-black/25 bg-white/45 text-stone-950 hover:bg-white/70 hover:text-stone-950 focus-visible:border-black/60 focus-visible:ring-black/60",
                )}
              >
                {userPaused ? <Play /> : <Pause />}
              </Button>
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => embla?.scrollPrev()}
                  aria-label="اسلاید قبلی"
                  className={cn(
                    "size-11 rounded-full backdrop-blur-md",
                    darkControls
                      ? "border-white/30 bg-black/20 text-white hover:bg-black/40 hover:text-white focus-visible:border-white focus-visible:ring-white/80"
                      : "border-black/25 bg-white/45 text-stone-950 hover:bg-white/70 hover:text-stone-950 focus-visible:border-black/60 focus-visible:ring-black/60",
                  )}
                >
                  <ChevronRight />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => embla?.scrollNext()}
                  aria-label="اسلاید بعدی"
                  className={cn(
                    "size-11 rounded-full backdrop-blur-md",
                    darkControls
                      ? "border-white/30 bg-black/20 text-white hover:bg-black/40 hover:text-white focus-visible:border-white focus-visible:ring-white/80"
                      : "border-black/25 bg-white/45 text-stone-950 hover:bg-white/70 hover:text-stone-950 focus-visible:border-black/60 focus-visible:ring-black/60",
                  )}
                >
                  <ChevronLeft />
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function HeroSlideView({
  slide,
  priority,
  active,
  position,
  total,
}: {
  slide: PublicHeroSlide;
  priority: boolean;
  active: boolean;
  position: number;
  total: number;
}) {
  const lightText = slide.theme === "dark";
  return (
    <div
      role="group"
      aria-roledescription="اسلاید"
      aria-label={`${position} از ${total}: ${slide.title}`}
      aria-hidden={active ? undefined : true}
      inert={active ? undefined : true}
      data-theme={slide.theme}
      className="relative min-w-0 shrink-0 grow-0 basis-full"
    >
      <div className="relative h-[78vh] max-h-[760px] min-h-[460px] w-full">
        <HeroResponsiveImage
          desktopSrc={slide.image_url}
          mobileSrc={slide.mobile_image_url}
          alt={slide.image_alt ?? slide.title}
          priority={priority}
        />
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-l",
            lightText
              ? "from-black/75 via-black/45 to-black/20"
              : "from-white/85 via-white/55 to-white/15",
          )}
        />
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t via-transparent",
            lightText
              ? "from-black/55 to-black/15"
              : "from-white/55 to-white/10",
          )}
        />
        {/* Seam fade — melts the bottom edge into the page below for a seamless join. */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

        {/* Content */}
        <div className="container-px absolute inset-0 z-10 mx-auto flex max-w-7xl items-center">
          <div
            className={cn(
              "max-w-xl text-start",
              lightText ? "text-white" : "text-stone-950",
            )}
          >
            {slide.eyebrow || slide.badge ? (
              <p
                className={cn(
                  "mb-4 inline-flex items-center gap-2 text-sm font-semibold",
                  lightText ? "text-primary" : "text-stone-900",
                )}
              >
                {slide.badge ? (
                  <Badge className="bg-gold text-gold-foreground">
                    {slide.badge}
                  </Badge>
                ) : null}
                {slide.eyebrow ?? null}
              </p>
            ) : null}

            <h2
              className={cn(
                "font-serif text-5xl leading-[1.3] sm:text-6xl lg:text-7xl",
                lightText
                  ? "text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]"
                  : "text-stone-950 [text-shadow:0_1px_20px_rgba(255,255,255,0.7)]",
              )}
            >
              {slide.title}
            </h2>

            {slide.subtitle ? (
              <p
                className={cn(
                  "mt-5 max-w-md text-base sm:text-lg",
                  lightText
                    ? "text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]"
                    : "text-stone-800 [text-shadow:0_1px_12px_rgba(255,255,255,0.65)]",
                )}
              >
                {slide.subtitle}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {slide.cta_label && slide.cta_href ? (
                <Button size="lg" className="h-12 px-6 text-sm" asChild>
                  <Link href={slide.cta_href}>
                    {slide.cta_label} <ArrowLeft />
                  </Link>
                </Button>
              ) : null}
              {slide.secondary_cta_label && slide.secondary_cta_href ? (
                <Button
                  size="lg"
                  variant="outline"
                  className={cn(
                    "h-12 px-6 text-sm backdrop-blur-md",
                    lightText
                      ? "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                      : "border-black/25 bg-white/45 text-stone-950 hover:bg-white/70 hover:text-stone-950",
                  )}
                  asChild
                >
                  <Link href={slide.secondary_cta_href}>
                    {slide.secondary_cta_label}
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
