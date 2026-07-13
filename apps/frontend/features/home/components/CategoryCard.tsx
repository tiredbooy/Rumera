import Link from "next/link";
import { createElement } from "react";
import { ArrowLeft } from "lucide-react";

import { SmartImage } from "@/components/smart-image";
import { Reveal } from "@/features/motion/components/reveal";
import { categoryIconFor } from "@/lib/home/category-icons";
import type { Category } from "@/features/catalog/categories/types";

interface CategoryCardProps {
  category: Category;
  delay?: number;
}

export function CategoryCard({ category, delay = 0 }: CategoryCardProps) {
  const isLarge = category.card_size === "large";

  return (
    <Reveal
      delay={delay}
      className={isLarge ? "col-span-2 row-span-2" : undefined}
    >
      <Link
        href={`/categories/${category.slug}`}
        className={`group/cat border-hairline relative flex h-full flex-col justify-end overflow-hidden rounded-2xl ring-1 ring-foreground/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-foreground/10 hover:ring-primary/40 sm:rounded-3xl ${
          isLarge ? "min-h-64 sm:min-h-80" : "min-h-44 sm:min-h-48"
        }`}
      >
        {/* Category image — uses the admin-set image_url, falls back to monogram in SmartImage */}
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/cat:scale-105">
          <SmartImage
            src={category.image_url ?? undefined}
            alt={category.title}
            sizes={
              isLarge
                ? "(max-width: 1024px) 100vw, 50vw"
                : "(max-width: 1024px) 50vw, 25vw"
            }
            monogram={category.title.charAt(0)}
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent transition-opacity duration-300 group-hover/cat:from-black/85" />

        <span className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-xl bg-white/10 text-white/90 ring-1 ring-white/20 backdrop-blur-md transition-colors group-hover/cat:bg-primary group-hover/cat:text-primary-foreground sm:end-4 sm:top-4 sm:size-10">
          {createElement(categoryIconFor(category.slug ?? ""), {
            className: "size-4 sm:size-5",
          })}
        </span>

        <div className="relative p-4 text-white sm:p-5">
          <h3
            className={`font-serif ${isLarge ? "text-2xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
          >
            {category.title}
          </h3>
          {category.description ? (
            <p className="mt-1 line-clamp-1 text-xs text-white/75 sm:text-sm">
              {category.description}
            </p>
          ) : null}
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur-md transition-colors group-hover/cat:bg-primary group-hover/cat:text-primary-foreground group-hover/cat:ring-primary sm:text-sm">
            خرید
            <ArrowLeft className="size-3.5 transition-transform group-hover/cat:-translate-x-0.5" />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}
