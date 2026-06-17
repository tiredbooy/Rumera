"use client"

import { Plus, Pencil, BookOpen } from "lucide-react"
import { toast } from "sonner"

import { categoryFa } from "@/lib/products"
import { adminRecipes } from "@/lib/admin/data"
import { Button } from "@/components/ui/button"
import { RecipeBadge } from "@/components/admin/status-badge"

export function RecipesBoard({ canWrite }: { canWrite: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {adminRecipes.map((recipe) => (
        <li
          key={recipe.id}
          className="border-hairline hover-lift group overflow-hidden rounded-2xl bg-card"
        >
          <div
            className="relative flex h-28 items-center justify-center overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${recipe.hue[0]}, ${recipe.hue[1]})`,
            }}
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
            <BookOpen className="relative size-7 text-white/90 transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute end-3 top-3">
              <RecipeBadge status={recipe.status} />
            </div>
          </div>
          <div className="p-5">
            <p className="font-serif text-base leading-snug">{recipe.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              همراهی با {categoryFa[recipe.pairedCategory]} · {recipe.author}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
              <span className="text-xs text-muted-foreground" dir="ltr">{recipe.updated}</span>
              {canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-me-2 gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => toast.info("ویرایشگر دستور (TipTap) به‌زودی متصل می‌شود")}
                >
                  <Pencil className="size-4" /> ویرایش
                </Button>
              ) : null}
            </div>
          </div>
        </li>
      ))}

      {canWrite ? (
        <li>
          <button
            type="button"
            onClick={() => toast.info("افزودن دستور تازه به‌زودی فعال می‌شود")}
            className="border-hairline flex h-full min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/60 hover:text-foreground"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border/60">
              <Plus className="size-5" />
            </span>
            <span className="text-sm">دستور جدید</span>
          </button>
        </li>
      ) : null}
    </ul>
  )
}
