"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Avoid a hydration mismatch: the server can't know the resolved theme, so the
  // icon stays neutral until the client has mounted (server snapshot → false).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="تغییر تم روشن و تاریک"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
