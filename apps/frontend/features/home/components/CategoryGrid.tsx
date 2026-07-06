import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/features/motion/components/reveal";
import { CategoryCard } from "./CategoryCard";
import type { CategoryResponse } from "@/features/categories/types";

interface CategoryGridProps {
  categories: CategoryResponse[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <section id="categories" className="container-px mx-auto max-w-7xl py-20">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">خرید بر اساس دسته‌بندی</p>
          <h2 className="font-serif text-4xl sm:text-5xl">
            هر چه می‌خواهید، یک‌جا
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="hidden sm:inline-flex"
        >
          <Link href="/products">
            مشاهدهٔ همه <ArrowLeft />
          </Link>
        </Button>
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            delay={Math.min(i, 4) * 0.05}
          />
        ))}
      </div>
    </section>
  );
}
