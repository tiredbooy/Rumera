import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import type { CategoryTree } from "@/features/catalog/categories/types";
import { faNum } from "@/lib/products";

/**
 * A single category card. The image stage uses `SmartImage` so a missing asset
 * degrades to the warm monogram fallback rather than a broken image. Child
 * categories appear as keyboard-reachable chips that link straight to their own
 * landing without leaving the parent's card link in the way.
 */
export function CategoryDirectoryCard({
  category,
}: {
  category: CategoryTree;
}) {
  const href = `/categories/${category.slug}`;
  const children = (category.children ?? []).filter((c) => Boolean(c.slug));
  const visibleChildren = children.slice(0, 4);
  const extraChildren = children.length - visibleChildren.length;

  return (
    <article className="group/cat border-hairline press shadow-e1 hover:shadow-e3 relative flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/5 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:ring-primary/30">
      {/* Image stage — the whole card surface links to the category page. The
          link stretches via the ::after overlay so child chips can sit above it. */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover/cat:scale-[1.05]">
          <SmartImage
            src={null}
            alt={category.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            monogram={category.title.charAt(0)}
            fallbackClassName="from-primary/20 via-card to-secondary"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent"
        />
        {/* Sheen sweep on hover — premium catch-light across the stage. */}
        <span
          aria-hidden
          className="sheen pointer-events-none absolute inset-0 -translate-x-full opacity-0 transition-all duration-700 ease-out group-hover/cat:translate-x-full group-hover/cat:opacity-100 motion-reduce:hidden"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <h2 className="font-serif text-2xl leading-tight">
          <Link
            href={href}
            className="outline-none transition-colors after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            data-category={category.slug}
          >
            {category.title}
          </Link>
        </h2>

        {category.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {category.description}
          </p>
        ) : null}

        {visibleChildren.length ? (
          <ul className="relative z-10 mt-1 flex flex-wrap gap-1.5">
            {visibleChildren.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/categories/${child.slug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {child.title}
                </Link>
              </li>
            ))}
            {extraChildren > 0 ? (
              <li>
                <span className="inline-flex min-h-9 items-center rounded-full border border-dashed border-border/70 px-3 py-1 text-xs text-muted-foreground">
                  {`+${faNum(extraChildren)} زیرشاخه`}
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {/* CTA — purely decorative affordance; the card title carries the link. */}
        <span
          aria-hidden
          className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-primary"
        >
          مشاهدهٔ دسته
          <ArrowLeft className="size-4 transition-transform duration-300 group-hover/cat:-translate-x-1" />
        </span>
      </div>
    </article>
  );
}
