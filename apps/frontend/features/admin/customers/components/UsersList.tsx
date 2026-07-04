"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * Client search island for the customers (users) list. Mirrors the URL-driven
 * pattern used elsewhere in the admin: typing debounces a push to the same
 * route with an updated `?q=` (and resets `?page=`), which re-runs the server
 * component's live fetch against `GET /admin/users`.
 */
export function UsersSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = React.useState(initialQuery)

  // Keep the field in sync if the URL changes from elsewhere (e.g. back nav)
  // by adjusting state during render — React's recommended alternative to a
  // sync effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [lastQuery, setLastQuery] = React.useState(initialQuery)
  if (initialQuery !== lastQuery) {
    setLastQuery(initialQuery)
    setValue(initialQuery)
  }

  const push = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const trimmed = next.trim()
      if (trimmed) params.set("q", trimmed)
      else params.delete("q")
      // A new query always returns to the first page.
      params.delete("page")
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams]
  )

  React.useEffect(() => {
    if (value === initialQuery) return
    const id = setTimeout(() => push(value), 350)
    return () => clearTimeout(id)
  }, [value, initialQuery, push])

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="جستجوی نام یا ایمیل…"
        aria-label="جستجوی کاربران"
        className="h-9 ps-8 pe-8"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="پاک کردن جستجو"
          onClick={() => {
            setValue("")
            push("")
          }}
          className="absolute inset-y-0 end-1 my-auto size-7 cursor-pointer text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

/** Loading skeleton for the users table while the server fetch is in flight. */
export function UsersListSkeleton() {
  return (
    <div
      className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]"
      aria-hidden
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border/40 px-4 py-3.5 last:border-0"
        >
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden h-5 w-20 animate-pulse rounded-full bg-muted sm:block" />
          <div className="hidden h-5 w-16 animate-pulse rounded-full bg-muted md:block" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
