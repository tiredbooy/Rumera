"use client"

import * as React from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"

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
 * then never animates again (`once: true`) so scrolling back up is calm and the
 * main thread stays free. Honours `prefers-reduced-motion`: motion-averse users
 * get the final state immediately with no animation.
 *
 * It's a thin client island — the content it wraps can be fully server-rendered,
 * so this adds interactivity without turning a page into a client component.
 */
export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  const reduceMotion = useReducedMotion()

  const variants: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : y },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      variants={variants}
    >
      {children}
    </motion.div>
  )
}
