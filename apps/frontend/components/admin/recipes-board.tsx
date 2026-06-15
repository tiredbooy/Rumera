"use client"

import { Plus, Pencil, BookOpen } from "lucide-react"
import { toast } from "sonner"

import { categoryFa } from "@/lib/products"
import { adminRecipes } from "@/lib/admin/data"
import { Button } from "@/components/ui/button"
import { RecipeBadge } from "@/components/admin/status-badge"

export function RecipesBoard({ canWrite }: { canWrite: boolean }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {adminRecipes.map((recipe) => (
        <li
          key={recipe.id}
          className="border-hairline group overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5"
        >
          <div
            className="relative flex h-28 items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${recipe.hue[0]}, ${recipe.hue[1]})`,
            }}
          >
            <BookOpen className="size-7 text-white/80" />
            <div className="absolute end-3 top-3">
              <RecipeBadge status={recipe.status} />
            </div>
          </div>
          <div className="p-5">
            <p className="font-serif text-lg">{recipe.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              همراهی با {categoryFa[recipe.pairedCategory]} · {recipe.author}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground" dir="ltr">{recipe.updated}</span>
              {canWrite ? (
                <Button
                  variant="ghost"
                  size="sm"
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
            className="border-hairline flex h-full min-h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-6" />
            <span className="text-sm">دستور جدید</span>
          </button>
        </li>
      ) : null}
    </ul>
  )
}
