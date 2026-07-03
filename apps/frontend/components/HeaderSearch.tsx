"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

interface HeaderSearchProps {
  /** "inline" = desktop bar in the header. "drawer" = full-width inside the mobile sheet. */
  variant?: "inline" | "drawer"
  autoFocus?: boolean
  /** Called after a successful submit — used by the mobile drawer to close itself. */
  onSubmitNavigate?: () => void
}

export function HeaderSearch({
  variant = "inline",
  autoFocus = false,
  onSubmitNavigate,
}: HeaderSearchProps) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const isDrawer = variant === "drawer"

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = value.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
    onSubmitNavigate?.()
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={isDrawer ? "relative w-full" : "group/search relative w-full max-w-md"}
    >
      <button
        type="submit"
        aria-label="جستجو"
        className="absolute top-1/2 start-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
      >
        <Search className="size-4" />
      </button>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="جستجوی محصول، برند یا دسته…"
        aria-label="جستجوی فروشگاه"
        autoFocus={autoFocus}
        className={
          isDrawer
            ? "h-11 w-full rounded-full border border-border/70 bg-secondary/50 ps-9 pe-9 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            : "h-10 w-full rounded-full border border-border/70 bg-secondary/50 ps-9 pe-9 text-sm outline-none transition-all placeholder:text-muted-foreground/80 focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
        }
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="پاک کردن"
          className="absolute top-1/2 end-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  )
}