"use client"

import * as React from "react"
import type { ChartAnimationOptions, ChartValue } from "@tanstack/charts"
import { Chart, type ChartProps } from "@tanstack/charts/react"

import { cn } from "@/lib/utils"

import { rumeraChartCssVars } from "./theme"

export type RumeraChartProps<
  TDatum = unknown,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
> = ChartProps<TDatum, TXValue, TYValue>

/**
 * Spread into `defineChart({ svgAnimation })`.
 * `Chart` has no motion prop; this is the library’s reduced-motion flag.
 * Springs: `motion({ respectReducedMotion: true })` from `@tanstack/charts/motion`.
 */
export const rumeraSvgAnimation = {
  duration: 280,
  easing: "ease-out",
  respectReducedMotion: true,
  resize: false,
} as const satisfies ChartAnimationOptions

/** True when the OS asks to minimise motion — gate definition-level animation. */
export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
      mq.addEventListener("change", notify)
      return () => mq.removeEventListener("change", notify)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}

export function RumeraChart<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>({
  definition,
  ariaLabel,
  className,
  style,
  height,
  aspectRatio,
  ...rest
}: RumeraChartProps<TDatum, TXValue, TYValue>) {
  const fillHost = height == null && aspectRatio == null
  return (
    <div
      dir="rtl"
      className={cn("rumera-chart w-full", className)}
      style={{ ...rumeraChartCssVars, ...style }}
    >
      <Chart
        definition={definition}
        ariaLabel={ariaLabel}
        height={height}
        aspectRatio={aspectRatio}
        className="h-full w-full"
        style={fillHost ? { height: "100%", minHeight: 320 } : { height: "100%" }}
        {...rest}
      />
    </div>
  )
}
