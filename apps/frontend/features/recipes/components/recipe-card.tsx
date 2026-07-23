import Link from "next/link";
import { Clock, Users, ArrowLeft, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SmartImage } from "@/components/smart-image";
import { faNum } from "@/lib/products";
import { difficultyFa, formatDuration } from "@/features/recipes/utils";
import type {
  RecipeDifficulty,
  RecipeListItem,
} from "@/features/recipes/types";

// Difficulty → dot colour, so the level reads at a glance.
const difficultyDot: Record<RecipeDifficulty, string> = {
  easy: "bg-emerald-500",
  medium: "bg-amber-500",
  hard: "bg-wine",
};

/**
 * RecipeCard — editorial card for the recipes grid & related rails.
 * Image area is 4:3 landscape — feed it ~1200×900 assets (see images README).
 */
export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const href = `/recipes/${recipe.slug}`;

  return (
    <article className="group/recipe press border-hairline shadow-e1 hover:shadow-e3 relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:ring-primary/30 sm:rounded-3xl">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Link
          href={href}
          className="absolute inset-0"
          aria-label={recipe.title}
        >
          <div className="absolute inset-0 transition-transform duration-[1200ms] ease-out group-hover/recipe:scale-[1.06]">
            <SmartImage
              src={recipe.image_url}
              alt={recipe.image_alt?.trim() || recipe.title}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              monogram={recipe.title.charAt(0)}
            />
          </div>
          {/* Scrim so the overlaid pills stay legible on any image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/10 opacity-90" />
        </Link>

        <div className="pointer-events-none absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5 sm:start-4 sm:top-4">
          {recipe.is_featured ? (
            <Badge className="bg-gold text-gold-foreground shadow-sm">
              <Star className="size-3 fill-current" /> منتخب
            </Badge>
          ) : null}
          {recipe.cocktail_type ? (
            <Badge
              variant="secondary"
              className="bg-background/85 shadow-sm backdrop-blur-sm"
            >
              {recipe.cocktail_type}
            </Badge>
          ) : null}
        </div>

        {/* Time pill overlaid on the image */}
        <span className="pointer-events-none absolute bottom-3 end-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm sm:bottom-4 sm:end-4">
          <Clock className="size-3.5" />{" "}
          {formatDuration(recipe.total_time_minutes)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 rounded-full",
                difficultyDot[recipe.difficulty],
              )}
            />
            {difficultyFa[recipe.difficulty]}
          </span>
          {recipe.servings > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" /> {faNum(recipe.servings)} نفر
            </span>
          ) : null}
        </div>

        <h3 className="line-clamp-2 font-serif text-xl leading-snug transition-colors group-hover/recipe:text-primary sm:text-2xl">
          <Link href={href}>{recipe.title}</Link>
        </h3>

        {recipe.excerpt ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {recipe.excerpt}
          </p>
        ) : null}

        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary">
          خواندن دستور
          <ArrowLeft className="size-4 transition-transform duration-300 group-hover/recipe:-translate-x-1" />
        </span>
      </div>
    </article>
  );
}
