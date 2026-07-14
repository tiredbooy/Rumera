import { faNum } from "@/lib/products"

import type { RecipeDifficulty } from "./types"

export const difficultyFa: Record<RecipeDifficulty, string> = {
  easy: "آسان",
  medium: "متوسط",
  hard: "پیشرفته",
}

/** Minutes to a localized Persian duration. */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—"
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0 && remainingMinutes > 0) {
    return `${faNum(hours)} ساعت و ${faNum(remainingMinutes)} دقیقه`
  }
  if (hours > 0) return `${faNum(hours)} ساعت`
  return `${faNum(remainingMinutes)} دقیقه`
}
