import Link from "next/link"
import { Clock, Users, ArrowLeft, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { SmartImage } from "@/components/smart-image"
import { faNum } from "@/lib/products"
import {
  difficultyFa,
  formatDuration,
  type RecipeDifficulty,
  type RecipeListItem,
} from "@/lib/recipes"

// Difficulty → dot colour, so the level reads at a glance.
const difficultyDot: Record<RecipeDifficulty, string> = {
  easy: "bg-emerald-500",
  medium: "bg-amber-500",
  hard: "bg-wine",
}

/**
 * RecipeCard — editorial card for the recipes grid & related rails.
 * Image area is 4:3 landscape — feed it ~1200×900 assets (see images README).
 */
export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const href = `/recipes/${recipe.slug}`

  return (
    <article className="group/recipe border-hairline relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-foreground/5 hover:ring-primary/30 sm:rounded-3xl">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Link href={href} className="absolute inset-0" aria-label={recipe.title}>
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/recipe:scale-105">
            <SmartImage
              src={recipe.image_url}
              alt={recipe.title}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              monogram={recipe.title.charAt(0)}
            />
          </div>
          {/* Scrim so the overlaid time pill stays legible on any image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80" />
        </Link>

        <div className="pointer-events-none absolute start-3 top-3 z-10 flex flex-col gap-1.5 sm:start-4 sm:top-4">
          {recipe.is_featured ? (
            <Badge className="bg-gold text-gold-foreground shadow-sm">
              <Star className="size-3 fill-current" /> منتخب
            </Badge>
          ) : null}
          {recipe.cocktail_type ? (
            <Badge variant="secondary" className="shadow-sm">
              {recipe.cocktail_type}
            </Badge>
          ) : null}
        </div>

        {/* Time pill overlaid on the image */}
        <span className="pointer-events-none absolute bottom-3 end-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm sm:bottom-4 sm:end-4">
          <Clock className="size-3.5" /> {formatDuration(recipe.total_time_minutes)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", difficultyDot[recipe.difficulty])} />
            {difficultyFa[recipe.difficulty]}
          </span>
          {recipe.servings > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {faNum(recipe.servings)} نفر
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-serif text-xl leading-tight transition-colors group-hover/recipe:text-primary sm:text-2xl">
          <Link href={href}>{recipe.title}</Link>
        </h3>

        {recipe.excerpt ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{recipe.excerpt}</p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          خواندن دستور
          <ArrowLeft className="size-4 transition-transform group-hover/recipe:-translate-x-1" />
        </span>
      </div>
    </article>
  )
}
