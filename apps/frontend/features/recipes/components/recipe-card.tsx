import Link from "next/link";
import { ArrowLeft, Clock, Star, Users } from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import type {
  RecipeDifficulty,
  RecipeListItem,
} from "@/features/recipes/types";
import { difficultyFa, formatDuration } from "@/features/recipes/utils";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

const difficultyDot: Record<RecipeDifficulty, string> = {
  easy: "bg-emerald-500",
  medium: "bg-amber-500",
  hard: "bg-wine",
};

export function RecipeCard({
  recipe,
  headingLevel = 2,
}: {
  recipe: RecipeListItem;
  headingLevel?: 2 | 3;
}) {
  const href = `/recipes/${encodeURIComponent(recipe.slug)}`;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="h-full">
      <Link
        href={href}
        className="group/recipe press border-hairline shadow-e1 hover:shadow-e3 relative flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 sm:rounded-3xl"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-500 ease-cellar group-hover/recipe:scale-[1.04]">
            <SmartImage
              src={recipe.image_url}
              alt={recipe.image_alt?.trim() || recipe.title}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              monogram={recipe.title.charAt(0)}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/10 opacity-90" />
          <div className="pointer-events-none absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5 sm:start-4 sm:top-4">
            {recipe.is_featured ? (
              <Badge className="bg-gold text-gold-foreground shadow-sm">
                <Star className="size-3 fill-current" aria-hidden="true" />{" "}
                منتخب
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
          <span className="pointer-events-none absolute bottom-3 end-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm sm:bottom-4 sm:end-4">
            <Clock className="size-3.5" aria-hidden="true" />
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
                aria-hidden="true"
              />
              {difficultyFa[recipe.difficulty]}
            </span>
            {recipe.servings > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {faNum(recipe.servings)} نفر
              </span>
            ) : null}
          </div>
          <Heading className="line-clamp-2 font-serif text-xl leading-snug transition-colors group-hover/recipe:text-primary sm:text-2xl">
            {recipe.title}
          </Heading>
          {recipe.excerpt ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {recipe.excerpt}
            </p>
          ) : null}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary">
            خواندن دستور
            <ArrowLeft
              className="size-4 transition-transform duration-300 group-hover/recipe:-translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </article>
  );
}
