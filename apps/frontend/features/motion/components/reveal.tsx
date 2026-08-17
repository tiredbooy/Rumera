"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type RevealProps = {
  children: React.ReactNode
  className?: string
  /** Stagger delay in seconds — use to cascade siblings. */
  delay?: number
  /** Travel distance in px before settling. */
  y?: number
}

/**
 * Lightweight scroll-reveal wrapper.
 *
 * Fades + lifts its children into place the first time they enter the viewport,
 * then never animates again so scrolling back up is calm. Honours
 * `prefers-reduced-motion`: motion-averse users get the final state immediately.
 *
 * CSS + IntersectionObserver only — the content it wraps can stay
 * server-rendered without pulling the motion runtime.
 */
export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "reveal-visible", className)}
      style={
        {
          "--reveal-delay": `${delay}s`,
          "--reveal-y": `${y}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
