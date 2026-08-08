import Link from "next/link";
import { ExternalLink, ShoppingBag } from "lucide-react";

import type { CommerceIngredient } from "@/features/recipes/commerce";
import { formatRecipeQuantity } from "@/features/recipes/utils";
import { faNum } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Materials list with commerce affordances when an ingredient is linked to a
 * live catalogue variant. Mobile-first rows with 44px action targets.
 */
export function RecipeIngredientList({
  ingredients,
  servings,
}: {
  ingredients: CommerceIngredient[];
  servings: number;
}) {
  if (ingredients.length === 0) {
    return (
      <p className="mt-6 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        فهرست مواد لازم برای این دستور ثبت نشده است.
      </p>
    );
  }

  return (
    <>
      {servings > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          برای {faNum(servings)} نفر
        </p>
      ) : null}
      <ul className="mt-6 space-y-1 text-sm">
        {ingredients.map((ing) => {
          const measure = [
            ing.quantity ? formatRecipeQuantity(ing.quantity) : undefined,
            ing.unit,
          ]
            .filter(Boolean)
            .join(" ");
          const linked = ing.linked;
          const available = linked?.is_available === true;

          return (
            <li
              key={ing.id}
              className="border-b border-border/40 py-3.5 last:border-0"
              data-ingredient-id={ing.id}
              data-linked={linked ? "true" : "false"}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    available
                      ? "bg-emerald-500"
                      : linked
                        ? "bg-destructive/70"
                        : "bg-primary",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-foreground">
                      {ing.ingredient_name}
                    </span>
                    {measure ? (
                      <span className="text-muted-foreground">— {measure}</span>
                    ) : null}
                    {ing.optional ? (
                      <span className="inline-block rounded-full bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
                        اختیاری
                      </span>
                    ) : null}
                  </div>
                  {ing.notes ? (
                    <p className="mt-0.5 text-xs text-muted-foreground/80">
                      {ing.notes}
                    </p>
                  ) : null}
                  {linked ? (
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
                          available
                            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {available ? "قابل خرید" : "ناموجود"}
                      </span>
                      <span className="text-muted-foreground">
                        {linked.product_title}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      لینک فروشگاهی ندارد
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {linked && available && ing.shopAnchor ? (
                      <Link
                        href={`#${ing.shopAnchor}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 text-xs font-medium text-primary outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <ShoppingBag className="size-3.5" aria-hidden />
                        خرید این ماده
                      </Link>
                    ) : null}
                    {linked && !available ? (
                      <Link
                        href={ing.alternativeHref}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                        یافتن جایگزین
                      </Link>
                    ) : null}
                    {!linked ? (
                      <Link
                        href={ing.alternativeHref}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        جستجو در فروشگاه
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
