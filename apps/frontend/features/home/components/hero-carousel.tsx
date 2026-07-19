"use client"

import * as React from "react"
import Link from "next/link"
import useEmblaCarousel from "embla-carousel-react"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SmartImage } from "@/components/smart-image"
import type { PublicHeroSlide } from "@/features/hero-slides/types"

const AUTOPLAY_MS = 6500

/**
 * HeroCarousel — the storefront's dynamic, admin-managed hero slider.
 *
 * Full-bleed editorial slides backed by the `/hero-slides` API. Built on embla
 * (already a dependency) with a lightweight autoplay loop — no extra plugin — that
 * pauses on hover, focus and pointer interaction, and never runs for
 * `prefers-reduced-motion` users. RTL-aware. Imagery flows through SmartImage so
 * missing placeholder assets degrade to a branded gradient instead of breaking.
 *
 * Image spec (drop assets at the slide's image_url — see public/images/README):
 *   desktop  2400×1350  (16:9)   ·   mobile  1080×1350  (4:5)
 */
export function HeroCarousel({ slides }: { slides: PublicHeroSlide[] }) {
  const [emblaRef, embla] = useEmblaCarousel({
    loop: slides.length > 1,
    direction: "rtl",
    align: "start",
  })
  const [selected, setSelected] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const dotScrollerRef = React.useRef<HTMLDivElement>(null)
  const dotRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const initialSelectionRef = React.useRef(true)

  const onSelect = React.useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap())
  }, [embla])

  React.useEffect(() => {
    if (!embla) return
    // `selected` starts at 0, which already matches the initial snap — so we
    // only need to subscribe; no synchronous setState in the effect body.
    embla.on("select", onSelect)
    embla.on("reInit", onSelect)
    return () => {
      embla.off("select", onSelect)
      embla.off("reInit", onSelect)
    }
  }, [embla, onSelect])

  React.useEffect(() => {
    if (initialSelectionRef.current) {
      initialSelectionRef.current = false
      return
    }
    const scroller = dotScrollerRef.current
    const dot = dotRefs.current[selected]
    if (!scroller || !dot) return

    const scrollerRect = scroller.getBoundingClientRect()
    const dotRect = dot.getBoundingClientRect()
    const delta =
      dotRect.left < scrollerRect.left
        ? dotRect.left - scrollerRect.left
        : dotRect.right > scrollerRect.right
          ? dotRect.right - scrollerRect.right
          : 0
    if (delta !== 0) scroller.scrollBy?.({ left: delta })
  }, [selected])

  // Lightweight autoplay — honours reduced-motion and pauses on interaction.
  React.useEffect(() => {
    if (!embla || paused || slides.length < 2) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return
    const id = window.setInterval(() => embla.scrollNext(), AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [embla, paused, slides.length])

  if (slides.length === 0) return null

  return (
    <section
      className="cellar-glow relative border-b border-border/60"
      aria-roledescription="carousel"
      aria-label="پیشنهادهای ویژه"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-hidden" ref={emblaRef}>
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
          <div className="container-px pointer-events-none absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-7xl items-center justify-between">
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
                    dotRefs.current[i] = node
                  }}
                  type="button"
                  onClick={() => embla?.scrollTo(i)}
                  aria-label={`نمایش اسلاید ${i + 1}: ${slide.title}`}
                  aria-current={i === selected}
                  className="group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:bg-black/40 focus-visible:ring-3 focus-visible:ring-white/90"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 rounded-full bg-white/50 transition-all duration-300 group-hover:bg-white/80 motion-reduce:transition-none",
                      i === selected ? "w-8 bg-white" : "w-1.5"
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Arrows */}
            <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => embla?.scrollPrev()}
                aria-label="اسلاید قبلی"
                className="size-11 rounded-full border-white/30 bg-black/20 text-white backdrop-blur-md hover:bg-black/40 hover:text-white focus-visible:border-white focus-visible:ring-white/80"
              >
                <ChevronRight />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => embla?.scrollNext()}
                aria-label="اسلاید بعدی"
                className="size-11 rounded-full border-white/30 bg-black/20 text-white backdrop-blur-md hover:bg-black/40 hover:text-white focus-visible:border-white focus-visible:ring-white/80"
              >
                <ChevronLeft />
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

function HeroSlideView({
  slide,
  priority,
  active,
  position,
  total,
}: {
  slide: PublicHeroSlide
  priority: boolean
  active: boolean
  position: number
  total: number
}) {
  // "dark" theme = dark image → light text; we render light text on a dark scrim
  // for both, since a readable scrim keeps any photography legible.
  return (
    <div
      role="group"
      aria-roledescription="اسلاید"
      aria-label={`${position} از ${total}: ${slide.title}`}
      aria-hidden={active ? undefined : true}
      inert={active ? undefined : true}
      className="relative min-w-0 shrink-0 grow-0 basis-full"
    >
      <div className="relative h-[78vh] max-h-[760px] min-h-[460px] w-full">
        <SmartImage
          src={slide.image_url}
          alt={slide.image_alt ?? slide.title}
          sizes="100vw"
          priority={priority}
          fallbackClassName="from-card via-card to-background"
        />
        {/* Legibility scrim — stronger toward the reading (start) edge in RTL. */}
        <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/45 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
        {/* Seam fade — melts the bottom edge into the page below for a seamless join. */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />

        {/* Content */}
        <div className="container-px absolute inset-0 z-10 mx-auto flex max-w-7xl items-center">
          <div className="max-w-xl text-start text-white">
            {slide.eyebrow ? (
              <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {slide.badge ? (
                  <Badge className="bg-gold text-gold-foreground">{slide.badge}</Badge>
                ) : null}
                {slide.eyebrow}
              </p>
            ) : null}

            <h1 className="font-serif text-5xl leading-[1.06] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] sm:text-6xl lg:text-7xl">
              {slide.title}
            </h1>

            {slide.subtitle ? (
              <p className="mt-5 max-w-md text-base text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-lg">
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
                  className="h-12 border-white/40 bg-white/10 px-6 text-sm text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                  asChild
                >
                  <Link href={slide.secondary_cta_href}>{slide.secondary_cta_label}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
