"use client"

import type { ChangeEvent } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ArrowDownUp } from "lucide-react"

/**
 * ProductSort — a native <select> that rewrites the `sortBy`/`orderBy` query
 * params (preserving search/category and resetting to page 1). Native control =
 * fully accessible + works the same on touch. The visible chrome is ours; the
 * real <select> sits transparently on top so the OS picker still opens.
 */
const OPTIONS = [
  { label: "جدیدترین", sortBy: "created_at", orderBy: "desc" },
  { label: "ارزان‌ترین", sortBy: "price", orderBy: "asc" },
  { label: "گران‌ترین", sortBy: "price", orderBy: "desc" },
  { label: "حروف الفبا", sortBy: "title", orderBy: "asc" },
] as const

export function ProductSort() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const current = `${params.get("sortBy") ?? "created_at"}:${params.get("orderBy") ?? "desc"}`
  const activeLabel =
    OPTIONS.find((o) => `${o.sortBy}:${o.orderBy}` === current)?.label ?? "جدیدترین"

  function onChange(e: ChangeEvent<HTMLSelectElement>) {
    const [sortBy, orderBy] = e.target.value.split(":")
    const next = new URLSearchParams(params.toString())
    next.set("sortBy", sortBy)
    next.set("orderBy", orderBy)
    next.delete("page")
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card/50 ps-4 pe-3 text-sm transition-colors hover:border-primary/40">
      <ArrowDownUp className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">مرتب‌سازی:</span>
      <span className="font-medium">{activeLabel}</span>
      <select
        aria-label="مرتب‌سازی محصولات"
        value={current}
        onChange={onChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {OPTIONS.map((o) => (
          <option key={o.label} value={`${o.sortBy}:${o.orderBy}`}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
